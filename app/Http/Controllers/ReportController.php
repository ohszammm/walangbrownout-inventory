<?php

namespace App\Http\Controllers;

use App\Services\Inventory;
use App\Services\Perms;
use App\Support\Clock;
use App\Support\Db;
use App\Support\HttpError;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReportController extends Controller
{
    private const META = [
        'inventory' => ['summary' => ['Inventory Summary', 'reports.inventory'], 'abc' => ['ABC Analysis', 'reports.inventory'], 'movement' => ['Stock Movement Report', 'reports.inventory'], 'discrepancy' => ['Stock Discrepancy Report', 'reports.inventory'], 'expiry' => ['Expiry Report', 'reports.inventory']],
        'purchasing' => ['summary' => ['Purchasing Summary', 'reports.purchasing'], 'po' => ['Purchase Order Report', 'reports.purchasing'], 'supplier' => ['Supplier Report', 'reports.purchasing'], 'replenishment' => ['Replenishment Report', 'reports.purchasing'], 'incoming' => ['Incoming Shipment Report', 'reports.purchasing']],
    ];

    private static function money($n): float { return round((float) $n, 2); }

    public function index()
    {
        $out = [];
        foreach (self::META as $group => $m) foreach ($m as $key => [$title, $perm]) $out[] = ['group' => $group, 'key' => $key, 'title' => $title, 'perm' => $perm];
        return response()->json($out);
    }

    public function show(Request $request, string $group, string $key)
    {
        $meta = self::META[$group][$key] ?? null;
        if (!$meta) throw HttpError::notFound('Unknown report');
        $user = $request->attributes->get('user');
        if (!$user) throw new HttpError(401, 'Please sign in.');
        if (!Perms::roleHas($user['role'], $meta[1])) throw HttpError::forbidden();
        $out = ['title' => $meta[0], 'generated' => gmdate('c')] + $this->{"{$group}_{$key}"}();
        if ($request->query('format') === 'csv') {
            $esc = fn ($v) => '"' . str_replace('"', '""', (string) ($v ?? '')) . '"';
            $lines = array_map(fn ($row) => implode(',', array_map($esc, $row)), array_merge([$out['columns']], $out['rows']));
            return new Response(implode("\n", $lines), 200, ['Content-Type' => 'text/csv', 'Content-Disposition' => "attachment; filename=\"$group-$key.csv\""]);
        }
        return response()->json($out);
    }

    private function inventory_summary(): array
    {
        $ps = Inventory::loadProducts();
        $value = array_sum(array_map(fn ($p) => $p['on_hand'] * $p['unit_cost'], $ps));
        return ['columns' => ['SKU', 'Product', 'Category', 'On hand', 'Reserved', 'Available', 'Reorder point', 'Status', 'Stock value'],
            'rows' => array_map(fn ($p) => [$p['sku'], $p['name'], $p['category'], $p['on_hand'], $p['reserved'], $p['available'], $p['reorder_point'], $p['status'], self::money($p['on_hand'] * $p['unit_cost'])], $ps),
            'totals' => ['Products' => count($ps), 'Units on hand' => array_sum(array_column($ps, 'on_hand')), 'Stock value' => self::money($value)]];
    }

    /** Review cycle per class: A is monitored closely and counted often, B follows the standard schedule, C is reviewed less often. */
    private const ABC_CYCLE = ['A' => ['Weekly', 7], 'B' => ['Monthly', 30], 'C' => ['Quarterly', 90]];

    /** Average demand multiplier over a full year for seasonal items (non-seasonal items use their plain average daily demand). */
    private static function seasonFactor(array $p): float
    {
        if (!(int) $p['seasonal'] || !$p['season_start'] || !$p['season_end']) return 1.0;
        $s = (int) $p['season_start'];
        $e = (int) $p['season_end'];
        $months = $e >= $s ? $e - $s + 1 : 12 - $s + 1 + $e;
        return 1 + (min(12, $months) / 12) * ((float) $p['season_mult'] - 1);
    }

    /**
     * ABC analysis by value and turnover. Yearly usage value = yearly units (seasonal-adjusted demand) x unit cost,
     * so it reflects both how fast an item moves and how much it is worth. A = top 80% of value, B = next 15%, C = last 5%.
     * Turns per year (yearly units / units on hand) shows how quickly stock rotates. Each class has a count and review cycle.
     */
    private function inventory_abc(): array
    {
        $ps = Db::all('SELECT p.sku, p.name, p.category, p.class, p.seasonal, p.season_start, p.season_end, p.season_mult, p.avg_daily_usage, p.unit_cost,
            (SELECT COALESCE(SUM(b.qty), 0) FROM batches b WHERE b.product_id = p.id) on_hand,
            (SELECT MAX(c.ts) FROM counts c WHERE c.product_id = p.id) last_count
            FROM products p WHERE p.active = 1');
        foreach ($ps as &$p) {
            $p['units'] = (float) $p['avg_daily_usage'] * 365 * self::seasonFactor($p);
            $p['value'] = $p['units'] * (float) $p['unit_cost'];
        }
        unset($p);
        usort($ps, fn ($a, $b) => $b['value'] <=> $a['value']);
        $total = array_sum(array_column($ps, 'value')) ?: 1;
        $cum = 0.0;
        $rows = [];
        $n = ['A' => 0, 'B' => 0, 'C' => 0];
        foreach ($ps as $i => $p) {
            $class = $cum < 0.80 * $total ? 'A' : ($cum < 0.95 * $total ? 'B' : 'C');
            $cum += $p['value'];
            $n[$class]++;
            $turns = (float) $p['on_hand'] > 0 ? round($p['units'] / (float) $p['on_hand'], 1) : null;
            $last = $p['last_count'] ? substr((string) $p['last_count'], 0, 10) : 'Never';
            $rows[] = [$i + 1, $p['sku'], $p['name'], $p['category'], self::money($p['value']), round($p['value'] / $total * 100, 1) . '%', round($cum / $total * 100, 1) . '%', $turns, $class, self::ABC_CYCLE[$class][0], $last, $p['class'] === $class ? 'OK' : 'Review'];
        }
        return ['columns' => ['Rank', 'SKU', 'Product', 'Category', 'Yearly usage value', '% of total', 'Cumulative %', 'Turns per year', 'ABC class', 'Review cycle', 'Last counted', 'Check'],
            'rows' => $rows,
            'totals' => ['Class A items' => $n['A'], 'Class B items' => $n['B'], 'Class C items' => $n['C'], 'Total yearly value' => self::money($total)]];
    }

    private function inventory_movement(): array
    {
        $rows = Db::all('SELECT m.ts, p.sku, p.name, m.type, m.qty, m.batch_code, m.ref, m.user_name FROM movements m JOIN products p ON p.id = m.product_id ORDER BY m.id DESC LIMIT 500');
        $by = [];
        foreach ($rows as $m) $by[$m['type']] = ($by[$m['type']] ?? 0) + 1;
        return ['columns' => ['Time', 'SKU', 'Product', 'Type', 'Qty', 'Batch', 'Reference', 'By'], 'rows' => array_map(fn ($m) => [$m['ts'], $m['sku'], $m['name'], $m['type'], $m['qty'], $m['batch_code'] ?: '-', $m['ref'] ?: '-', $m['user_name']], $rows), 'totals' => (object) $by];
    }

    private function inventory_discrepancy(): array
    {
        $rows = Db::all('SELECT c.*, p.sku, p.name FROM counts c JOIN products p ON p.id = c.product_id WHERE c.physical_qty <> c.system_qty ORDER BY c.id DESC');
        return ['columns' => ['Count', 'SKU', 'Product', 'System', 'Physical', 'Difference', 'Status', 'Counted by', 'Resolution'],
            'rows' => array_map(fn ($c) => [$c['code'], $c['sku'], $c['name'], $c['system_qty'], $c['physical_qty'], $c['physical_qty'] - $c['system_qty'], $c['status'], $c['counted_by'], $c['resolution'] ?: '-'], $rows),
            'totals' => ['Discrepancies' => count($rows), 'Unresolved' => count(array_filter($rows, fn ($c) => $c['status'] !== 'resolved')), 'Net units' => array_sum(array_map(fn ($c) => $c['physical_qty'] - $c['system_qty'], $rows))]];
    }

    private function inventory_expiry(): array
    {
        $rows = Db::all('SELECT b.*, p.sku, p.name FROM batches b JOIN products p ON p.id = b.product_id WHERE b.qty > 0 AND b.expiry IS NOT NULL ORDER BY b.expiry');
        $t = Clock::today();
        return ['columns' => ['Batch', 'SKU', 'Product', 'Qty', 'Expiry', 'Days left', 'Status'],
            'rows' => array_map(function ($b) { $d = Clock::daysUntil($b['expiry']); return [$b['code'], $b['sku'], $b['name'], $b['qty'], $b['expiry'], $d, $d < 0 ? 'Expired' : ($d <= 30 ? 'Expiring' : 'Good')]; }, $rows),
            'totals' => ['Perishable batches' => count($rows), 'Expired' => count(array_filter($rows, fn ($b) => $b['expiry'] < $t)), 'Expiring ≤30d' => count(array_filter($rows, fn ($b) => $b['expiry'] >= $t && Clock::daysUntil($b['expiry']) <= 30))]];
    }

    private function purchasing_summary(): array
    {
        $rows = Db::all('SELECT o.code, s.name supplier, o.status, o.created, (SELECT SUM(qty*unit_cost) FROM po_items WHERE po_id = o.id) total FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id ORDER BY o.id DESC');
        $sum = fn (array $st) => array_sum(array_map(fn ($x) => in_array($x['status'], $st, true) ? (float) $x['total'] : 0, $rows));
        return ['columns' => ['PO', 'Supplier', 'Status', 'Created', 'Value'], 'rows' => array_map(fn ($x) => [$x['code'], $x['supplier'], $x['status'], $x['created'], self::money($x['total'])], $rows),
            'totals' => ['Purchase orders' => count($rows), 'Open value' => self::money($sum(['draft', 'sent'])), 'Received value' => self::money($sum(['received']))]];
    }

    private function purchasing_po(): array
    {
        $rows = Db::all('SELECT o.code, s.name supplier, o.status, p.sku, p.name, i.qty, i.received_qty, i.unit_cost FROM po_items i JOIN purchase_orders o ON o.id = i.po_id JOIN suppliers s ON s.id = o.supplier_id JOIN products p ON p.id = i.product_id ORDER BY o.id DESC');
        return ['columns' => ['PO', 'Supplier', 'Status', 'SKU', 'Product', 'Ordered', 'Received', 'Line value'], 'rows' => array_map(fn ($x) => [$x['code'], $x['supplier'], $x['status'], $x['sku'], $x['name'], $x['qty'], $x['received_qty'], self::money($x['qty'] * $x['unit_cost'])], $rows),
            'totals' => ['Lines' => count($rows), 'Units ordered' => array_sum(array_column($rows, 'qty'))]];
    }

    private function purchasing_supplier(): array
    {
        $rows = Db::all("SELECT s.id, s.name, s.status, s.lead_time_days, COUNT(o.id) pos, COALESCE(SUM(CASE WHEN o.status='received' THEN 1 ELSE 0 END),0) rec FROM suppliers s LEFT JOIN purchase_orders o ON o.supplier_id = s.id GROUP BY s.id, s.name, s.status, s.lead_time_days ORDER BY s.name");
        $var = [];
        foreach (Db::all("SELECT o.supplier_id, COUNT(*) c FROM incoming i JOIN purchase_orders o ON o.id = i.po_id WHERE i.status = 'variance' GROUP BY o.supplier_id") as $x) $var[$x['supplier_id']] = (int) $x['c'];
        return ['columns' => ['Supplier', 'Status', 'Lead time (days)', 'POs', 'Received', 'Shipments with variance'], 'rows' => array_map(fn ($x) => [$x['name'], $x['status'], $x['lead_time_days'], (int) $x['pos'], (int) $x['rec'], $var[$x['id']] ?? 0], $rows), 'totals' => ['Suppliers' => count($rows)]];
    }

    private function purchasing_replenishment(): array
    {
        $ps = array_values(array_filter(Inventory::loadProducts(), fn ($p) => $p['sellable'] <= $p['reorder_point'] * 1.25));
        return ['columns' => ['SKU', 'Product', 'Available stock', 'On order', 'Reorder point', 'Suggested qty', 'Supplier'], 'rows' => array_map(fn ($p) => [$p['sku'], $p['name'], $p['sellable'], $p['on_order'], $p['reorder_point'], $p['suggested_qty'], $p['supplier_name'] ?: '-'], $ps),
            'totals' => ['Items to replenish' => count(array_filter($ps, fn ($p) => $p['sellable'] <= $p['reorder_point'])), 'Watch list' => count(array_filter($ps, fn ($p) => $p['sellable'] > $p['reorder_point']))]];
    }

    private function purchasing_incoming(): array
    {
        $rows = Db::all('SELECT i.code, o.code po, s.name supplier, i.expected_date, i.status, i.received_date FROM incoming i JOIN purchase_orders o ON o.id = i.po_id JOIN suppliers s ON s.id = o.supplier_id ORDER BY i.expected_date DESC');
        $t = Clock::today();
        $st = fn ($x) => (in_array($x['status'], ['expected', 'delayed'], true) && $x['expected_date'] < $t) ? 'delayed' : $x['status'];
        return ['columns' => ['Shipment', 'PO', 'Supplier', 'Expected', 'Status', 'Received on'], 'rows' => array_map(fn ($x) => [$x['code'], $x['po'], $x['supplier'], $x['expected_date'], $st($x), $x['received_date'] ?: '-'], $rows),
            'totals' => ['Shipments' => count($rows), 'Delayed' => count(array_filter($rows, fn ($x) => $st($x) === 'delayed'))]];
    }
}
