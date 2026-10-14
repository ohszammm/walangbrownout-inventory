<?php

namespace App\Services;

use App\Support\Clock;
use App\Support\Db;

/**
 * Builds the alert list on the fly from current stock, batches, counts and shipments (alerts are derived, not stored).
 * Only the staff-set state (open/acknowledged/investigating/resolved) is saved, in alert_states, keyed by the alert key.
 */
class Alerts
{
    private const RANK = ['CRITICAL' => 0, 'HIGH' => 1, 'MEDIUM' => 2, 'LOW' => 3];
    public const GROUPS = ['low_stock' => ['low_stock', 'overstock'], 'expiry' => ['expiry', 'expired'], 'discrepancy' => ['discrepancy', 'variance']];

    /**
     * Returns all active alerts sorted by priority: low stock, overstock, expired/expiring batches,
     * count discrepancies, receiving variances and delayed shipments. Resolved alerts are hidden unless $includeResolved.
     */
    public static function derive(bool $includeResolved = false): array
    {
        $out = [];
        $t = Clock::today();
        $warn = Settings::num('expiry_warning_days');
        // 1. Stock-level alerts: low stock (at or below the reorder point) and overstock (above the maximum).
        foreach (Inventory::loadProducts() as $p) {
            if ($p['sellable'] <= $p['reorder_point'] && $p['status'] !== 'OVERSTOCK') {
                $pr = in_array($p['status'], ['OUT', 'CRITICAL'], true) ? 'CRITICAL' : 'HIGH';
                $out[] = ['key' => "low_stock:{$p['id']}", 'type' => 'low_stock', 'priority' => $pr, 'product_id' => $p['id'], 'sku' => $p['sku'], 'product' => $p['name'],
                    'title' => "Low stock: {$p['name']}", 'message' => "{$p['sellable']} on hand vs reorder point {$p['reorder_point']}" . ($p['on_order'] ? " ({$p['on_order']} already on order)" : '') . '.',
                    'current' => $p['sellable'], 'threshold' => $p['reorder_point'], 'suggested_qty' => $p['suggested_qty'], 'supplier' => $p['supplier_name']];
            }
            if ($p['status'] === 'OVERSTOCK') {
                $out[] = ['key' => "overstock:{$p['id']}", 'type' => 'overstock', 'priority' => 'LOW', 'product_id' => $p['id'], 'sku' => $p['sku'], 'product' => $p['name'],
                    'title' => "Overstock: {$p['name']}", 'message' => "{$p['on_hand']} on hand exceeds the maximum of {$p['max_stock']}. Hold new purchase orders.", 'current' => $p['on_hand'], 'threshold' => $p['max_stock']];
            }
        }
        // 2. Batch alerts: expired batches (critical) and batches inside the expiry warning window.
        foreach (Db::all('SELECT b.*, p.sku, p.name pname FROM batches b JOIN products p ON p.id = b.product_id WHERE b.qty > 0 AND b.expiry IS NOT NULL AND p.active = 1') as $b) {
            $d = Clock::daysUntil($b['expiry']);
            if ($b['expiry'] < $t) {
                $out[] = ['key' => "expired:{$b['id']}", 'type' => 'expired', 'priority' => 'CRITICAL', 'product_id' => $b['product_id'], 'sku' => $b['sku'], 'product' => $b['pname'], 'batch' => $b['code'],
                    'title' => "Expired batch: {$b['pname']}", 'message' => "Batch {$b['code']} expired " . (-$d) . " day(s) ago ({$b['expiry']}). {$b['qty']} unit(s) must be quarantined and excluded from picking.", 'expiry' => $b['expiry'], 'days_left' => $d, 'qty' => $b['qty']];
            } elseif ($d <= $warn) {
                $out[] = ['key' => "expiry:{$b['id']}", 'type' => 'expiry', 'priority' => $d <= 7 ? 'HIGH' : 'MEDIUM', 'product_id' => $b['product_id'], 'sku' => $b['sku'], 'product' => $b['pname'], 'batch' => $b['code'],
                    'title' => "Expiring soon: {$b['pname']}", 'message' => "Batch {$b['code']} expires {$b['expiry']} ($d day" . ($d === 1 ? '' : 's') . '). Follow FEFO: pick this batch first.', 'expiry' => $b['expiry'], 'days_left' => $d, 'qty' => $b['qty']];
            }
        }
        // 3. Discrepancy alerts: an unresolved physical count that differs from the system figure.
        foreach (Db::all("SELECT c.*, p.sku, p.name pname FROM counts c JOIN products p ON p.id = c.product_id WHERE c.status IN ('open','investigating') AND c.physical_qty <> c.system_qty") as $c) {
            $diff = $c['physical_qty'] - $c['system_qty'];
            $out[] = ['key' => "discrepancy:{$c['id']}", 'type' => 'discrepancy',
                'priority' => (abs($diff) >= 10 || abs($diff) / max(1, $c['system_qty']) >= 0.2) ? 'CRITICAL' : 'HIGH',
                'product_id' => $c['product_id'], 'sku' => $c['sku'], 'product' => $c['pname'], 'count_id' => $c['id'], 'count_code' => $c['code'],
                'title' => "Stock discrepancy: {$c['pname']}", 'message' => "System shows {$c['system_qty']}, physical count found {$c['physical_qty']} (" . ($diff > 0 ? '+' : '') . "$diff)." . ($c['status'] === 'investigating' ? ' Under investigation.' : ''),
                'system_qty' => $c['system_qty'], 'physical_qty' => $c['physical_qty'], 'diff' => $diff, 'count_status' => $c['status'], 'assigned_to' => $c['assigned_to']];
        }
        // 4. Receiving variances: shipments where the received quantity differs from the ordered quantity.
        foreach (Db::all("SELECT i.*, o.code po_code FROM incoming i JOIN purchase_orders o ON o.id = i.po_id WHERE i.status = 'variance'") as $s) {
            $items = Db::all('SELECT pi.*, p.name pname, p.sku FROM po_items pi JOIN products p ON p.id = pi.product_id WHERE po_id = ?', [$s['po_id']]);
            foreach ($items as $x) {
                if ($x['received_qty'] === $x['qty']) continue;
                $dv = $x['received_qty'] - $x['qty'];
                $out[] = ['key' => "variance:{$s['id']}:{$x['product_id']}", 'type' => 'variance', 'priority' => 'MEDIUM', 'product_id' => $x['product_id'], 'sku' => $x['sku'], 'product' => $x['pname'],
                    'title' => "Receiving variance: {$x['pname']}", 'message' => "{$s['code']} ({$s['po_code']}): expected {$x['qty']}, received {$x['received_qty']} (" . ($dv > 0 ? '+' : '') . "$dv).", 'incoming_id' => $s['id']];
            }
        }
        // 5. Delayed shipments: expected date has passed and the shipment is not yet received.
        foreach (Db::all("SELECT i.*, o.code po_code, sp.name supplier FROM incoming i JOIN purchase_orders o ON o.id = i.po_id JOIN suppliers sp ON sp.id = o.supplier_id WHERE i.status IN ('expected','delayed')") as $s) {
            if ($s['expected_date'] < $t) {
                $out[] = ['key' => "delayed:{$s['id']}", 'type' => 'delayed', 'priority' => 'MEDIUM', 'title' => "Delayed shipment: {$s['code']}",
                    'message' => "{$s['po_code']} from {$s['supplier']} was due {$s['expected_date']} (" . (-Clock::daysUntil($s['expected_date'])) . ' day(s) late).', 'incoming_id' => $s['id']];
            }
        }
        // Overlay the staff-set state saved for each alert key.
        $states = [];
        foreach (Db::all('SELECT * FROM alert_states') as $s) $states[$s['akey']] = $s;
        $res = [];
        foreach ($out as $a) {
            $st = $states[$a['key']] ?? null;
            $a['state'] = $st['state'] ?? 'open';
            $a['state_by'] = $st['by_user'] ?? null;
            $a['state_note'] = $st['note'] ?? null;
            if ($includeResolved || $a['state'] !== 'resolved') $res[] = $a;
        }
        usort($res, fn ($x, $y) => self::RANK[$x['priority']] <=> self::RANK[$y['priority']] ?: strcmp($x['title'], $y['title']));
        return $res;
    }
}
