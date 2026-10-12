<?php

namespace App\Http\Controllers;

use App\Services\Alerts;
use App\Services\Inventory;
use App\Support\Clock;
use App\Support\Db;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private static function pct(int $n, int $d): int { return $d ? (int) round($n / $d * 100) : 0; }
    private static function slim(array $o): array { return ['id' => $o['id'], 'code' => $o['code'], 'customer' => $o['customer'], 'status' => $o['status'], 'created' => $o['created']]; }
    private static function units(int $id): int { return Db::count('SELECT COALESCE(SUM(qty),0) c FROM so_items WHERE so_id = ?', [$id]); }
    private static function ofType(array $alerts, array $types): array { return array_values(array_filter($alerts, fn ($a) => in_array($a['type'], $types, true))); }

    private function admin(): array
    {
        $alerts = Alerts::derive();
        $d30 = gmdate('c', time() - 30 * 86400);
        $d7 = gmdate('c', time() - 7 * 86400);
        return [
            'kpis' => ['total_users' => Db::count('SELECT COUNT(*) c FROM users'), 'active_users' => Db::count("SELECT COUNT(*) c FROM users WHERE status='active'"), 'pending_inactive' => Db::count("SELECT COUNT(*) c FROM users WHERE status <> 'active'"), 'system_alerts' => count($alerts)],
            'user_activity' => ['new_users' => Db::count('SELECT COUNT(*) c FROM users WHERE created_at >= ?', [$d30]), 'active_recently' => Db::count('SELECT COUNT(*) c FROM users WHERE last_login >= ?', [$d7]), 'disabled' => Db::count("SELECT COUNT(*) c FROM users WHERE status='disabled'"), 'pending' => Db::count("SELECT COUNT(*) c FROM users WHERE status='pending'")],
            'system_status' => ['system' => 'online', 'database' => 'connected', 'backend' => 'connected'],
            'recent_activity' => Db::all('SELECT ts, user_name, action, detail FROM audit_logs ORDER BY id DESC LIMIT 8'),
        ];
    }

    private function inventory(): array
    {
        $ps = Inventory::loadProducts();
        $alerts = Alerts::derive();
        $n = count($ps);
        $crit = count(array_filter($ps, fn ($p) => in_array($p['status'], ['CRITICAL', 'OUT'], true)));
        $low = count(array_filter($ps, fn ($p) => $p['status'] === 'LOW'));
        return [
            'kpis' => ['total_products' => $n, 'low_stock' => $low + $crit, 'expiring_soon' => count(self::ofType($alerts, ['expiry', 'expired'])), 'discrepancies' => count(self::ofType($alerts, ['discrepancy']))],
            'health' => ['normal' => self::pct($n - $low - $crit, $n), 'low' => self::pct($low, $n), 'critical' => self::pct($crit, $n)],
            'low_stock' => array_slice(self::ofType($alerts, ['low_stock']), 0, 5),
            'expiry' => array_slice(self::ofType($alerts, ['expiry', 'expired']), 0, 5),
            'discrepancies' => array_slice(self::ofType($alerts, ['discrepancy']), 0, 5),
            'pending_adjustments' => Db::count("SELECT COUNT(*) c FROM adjustments WHERE status='pending'"),
        ];
    }

    private function purchasing(): array
    {
        $reorder = [];
        foreach (Inventory::loadProducts() as $p) {
            if ($p['sellable'] <= $p['reorder_point'] && $p['status'] !== 'OVERSTOCK') {
                $reorder[] = ['sku' => $p['sku'], 'name' => $p['name'], 'current' => $p['sellable'], 'reorder_point' => $p['reorder_point'], 'suggested_qty' => $p['suggested_qty'], 'priority' => in_array($p['status'], ['OUT', 'CRITICAL'], true) ? 'CRITICAL' : 'HIGH'];
            }
        }
        $t = Clock::today();
        return [
            'kpis' => ['to_reorder' => count($reorder), 'pending_pos' => Db::count("SELECT COUNT(*) c FROM purchase_orders WHERE status IN ('draft','sent')"), 'incoming' => Db::count("SELECT COUNT(*) c FROM incoming WHERE status IN ('expected','delayed')"), 'suppliers' => Db::count("SELECT COUNT(*) c FROM suppliers WHERE status='active'")],
            'reorder' => array_slice($reorder, 0, 6),
            'pending_pos' => Db::all("SELECT o.id, o.code, o.status, o.expected, s.name supplier FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE o.status IN ('draft','sent') ORDER BY o.id DESC LIMIT 5"),
            'incoming' => array_map(fn ($s) => ['status' => $s['expected_date'] < $t ? 'delayed' : $s['status']] + $s, Db::all("SELECT i.id, i.code, i.expected_date, i.status, o.code po_code FROM incoming i JOIN purchase_orders o ON o.id = i.po_id WHERE i.status IN ('expected','delayed') ORDER BY i.expected_date LIMIT 5")),
            'history' => Db::all("SELECT o.id, o.code, o.status, o.created, s.name supplier FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE o.status IN ('received','cancelled') ORDER BY o.id DESC LIMIT 5"),
        ];
    }

    private function warehouse(): array
    {
        $alerts = Alerts::derive();
        $toReceive = Db::all("SELECT i.id, i.code, i.expected_date, i.status, o.code po_code FROM incoming i JOIN purchase_orders o ON o.id = i.po_id WHERE i.status IN ('expected','delayed') ORDER BY i.expected_date");
        $toPick = array_map(fn ($o) => self::slim($o) + ['units' => self::units($o['id'])], Db::all("SELECT * FROM sales_orders WHERE status IN ('pending','picking') ORDER BY id"));
        $toShip = array_map(fn ($o) => self::slim($o) + ['units' => self::units($o['id'])], Db::all("SELECT * FROM sales_orders WHERE status = 'ready' ORDER BY id"));
        $tasks = Db::all("SELECT c.id, c.code, c.status, c.system_qty, c.physical_qty, p.name product FROM counts c JOIN products p ON p.id = c.product_id WHERE c.status IN ('open','investigating') AND c.physical_qty <> c.system_qty");
        return [
            'kpis' => ['to_receive' => count($toReceive), 'to_pick' => count($toPick), 'to_ship' => count($toShip), 'stock_tasks' => count($tasks)],
            'to_receive' => array_slice($toReceive, 0, 5), 'to_pick' => array_slice($toPick, 0, 5), 'to_ship' => array_slice($toShip, 0, 5), 'inventory_tasks' => array_slice($tasks, 0, 5),
            'alerts' => array_map(fn ($a) => ['key' => $a['key'], 'type' => $a['type'], 'priority' => $a['priority'], 'title' => $a['title'], 'message' => $a['message'], 'state' => $a['state']], array_slice(self::ofType($alerts, ['expiry', 'expired', 'discrepancy', 'low_stock']), 0, 6)),
        ];
    }

    private function sales(): array
    {
        $ps = Inventory::loadProducts();
        $status = [];
        foreach (['pending', 'picking', 'ready', 'shipped'] as $s) $status[$s] = Db::count('SELECT COUNT(*) c FROM sales_orders WHERE status = ?', [$s]);
        $by = fn (string $a) => count(array_filter($ps, fn ($p) => $p['availability'] === $a));
        return [
            'kpis' => ['today_orders' => Db::count("SELECT COUNT(*) c FROM sales_orders WHERE substr(created,1,10) = ? AND status <> 'cancelled'", [Clock::today()]), 'pending_orders' => $status['pending'], 'ready_to_ship' => $status['ready'], 'available_units' => array_sum(array_column($ps, 'available')), 'products' => count($ps)],
            'availability' => ['available' => $by('Available'), 'low' => $by('Low Stock'), 'out' => $by('Out of Stock')],
            'recent_orders' => array_map(fn ($o) => self::slim($o) + ['units' => self::units($o['id'])], Db::all('SELECT * FROM sales_orders ORDER BY id DESC LIMIT 6')),
            'status' => $status,
            'low_stock' => array_map(fn ($p) => ['sku' => $p['sku'], 'name' => $p['name'], 'available' => $p['available'], 'status' => $p['availability']], array_slice(array_values(array_filter($ps, fn ($p) => $p['availability'] !== 'Available')), 0, 6)),
        ];
    }

    /** Chart data shown on the dashboards (weekly buckets and simple breakdowns). */
    private function charts(string $role): array
    {
        $out = [];
        $today = Clock::today();
        if ($role === 'admin') {
            $roles = ['admin' => 'System Admin', 'inventory' => 'Inventory', 'purchasing' => 'Purchasing', 'warehouse' => 'Warehouse', 'sales' => 'Sales'];
            $counts = array_column(Db::all("SELECT role, COUNT(*) n FROM users WHERE status = 'active' GROUP BY role"), 'n', 'role');
            $out['users_by_role'] = array_map(fn ($k, $l) => ['label' => $l, 'value' => (int) ($counts[$k] ?? 0)], array_keys($roles), $roles);
            $days = [];
            for ($i = 13; $i >= 0; $i--) $days[Clock::addDays($today, -$i)] = 0;
            foreach (Db::all('SELECT substr(ts,1,10) d, COUNT(*) n FROM audit_logs WHERE ts >= ? GROUP BY substr(ts,1,10)', [Clock::addDays($today, -13)]) as $r) {
                if (isset($days[$r['d']])) $days[$r['d']] = (int) $r['n'];
            }
            $out['activity'] = array_map(fn ($d, $n) => ['label' => date('M j', strtotime($d)), 'value' => $n], array_keys($days), $days);
            return $out;
        }
        if ($role === 'sales') return $out;

        $ps = Inventory::loadProducts();
        $crit = $low = $over = 0;
        foreach ($ps as $p) {
            if (in_array($p['status'], ['CRITICAL', 'OUT'], true)) $crit++;
            elseif ($p['status'] === 'LOW') $low++;
            elseif ($p['status'] === 'OVERSTOCK') $over++;
        }
        $out['stock_status'] = [
            ['label' => 'Healthy', 'value' => count($ps) - $crit - $low - $over, 'tone' => 'ok'],
            ['label' => 'Low', 'value' => $low, 'tone' => 'warning'],
            ['label' => 'Critical', 'value' => $crit, 'tone' => 'critical'],
            ['label' => 'Overstock', 'value' => $over, 'tone' => 'info'],
        ];
        if ($role === 'purchasing') {
            $out['po_by_status'] = array_map(fn ($r) => ['label' => ucfirst($r['status']), 'value' => (int) $r['n']], Db::all('SELECT status, COUNT(*) n FROM purchase_orders GROUP BY status ORDER BY n DESC'));
            $out['spend_by_supplier'] = array_map(fn ($r) => ['label' => $r['name'], 'value' => (float) $r['v']], Db::all("SELECT s.name, SUM(i.qty * i.unit_cost) v FROM po_items i JOIN purchase_orders o ON o.id = i.po_id JOIN suppliers s ON s.id = o.supplier_id WHERE o.status <> 'cancelled' GROUP BY s.id, s.name ORDER BY v DESC LIMIT 6"));
            return $out;
        }
        $out['stock_by_category'] = array_map(fn ($r) => ['label' => $r['category'], 'value' => (int) $r['v']], Db::all('SELECT p.category, SUM(b.qty) v FROM batches b JOIN products p ON p.id = b.product_id GROUP BY p.category ORDER BY v DESC'));
        // 8 weekly buckets, oldest first: units received vs units picked
        $weeks = [];
        for ($i = 7; $i >= 0; $i--) { $start = Clock::addDays($today, -7 * ($i + 1) + 1); $weeks[] = ['start' => $start, 'end' => Clock::addDays($start, 6), 'in' => 0, 'out' => 0]; }
        foreach (Db::all("SELECT substr(ts,1,10) d, type, qty FROM movements WHERE type IN ('Received','Picked') AND substr(ts,1,10) >= ?", [$weeks[0]['start']]) as $m) {
            foreach ($weeks as &$w) {
                if ($m['d'] >= $w['start'] && $m['d'] <= $w['end']) { $m['type'] === 'Received' ? $w['in'] += abs((int) $m['qty']) : $w['out'] += abs((int) $m['qty']); break; }
            }
            unset($w);
        }
        $out['movement_trend'] = array_map(fn ($w) => ['label' => date('M j', strtotime($w['start'])), 'in' => $w['in'], 'out' => $w['out']], $weeks);
        return $out;
    }

    public function dashboard(Request $request): JsonResponse
    {
        $role = $request->attributes->get('user')['role'];
        return response()->json(['role' => $role] + $this->$role() + ['charts' => $this->charts($role)]);
    }

    public function badges(Request $request): JsonResponse
    {
        if (!$request->attributes->get('user')) return response()->json((object) []);
        $alerts = Alerts::derive();
        $n = fn (array $types) => count(self::ofType($alerts, $types));
        return response()->json([
            'alerts' => count($alerts), 'low_stock' => $n(['low_stock']), 'expiry' => $n(['expiry', 'expired']), 'discrepancies' => $n(['discrepancy']),
            'incoming' => Db::count("SELECT COUNT(*) c FROM incoming WHERE status IN ('expected','delayed')"),
            'pick' => Db::count("SELECT COUNT(*) c FROM sales_orders WHERE status IN ('pending','picking')"),
            'ship' => Db::count("SELECT COUNT(*) c FROM sales_orders WHERE status = 'ready'"),
            'adjustments' => Db::count("SELECT COUNT(*) c FROM adjustments WHERE status = 'pending'"),
            'pending_users' => Db::count("SELECT COUNT(*) c FROM users WHERE status = 'pending'"),
            'reorder' => $n(['low_stock']),
        ]);
    }
}
