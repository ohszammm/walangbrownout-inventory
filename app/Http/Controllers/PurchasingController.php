<?php

namespace App\Http\Controllers;

use App\Services\Audit;
use App\Services\Inventory;
use App\Services\Stock;
use App\Support\Clock;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\V;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Reorder suggestions, suppliers, purchase orders and receiving of incoming shipments.
 */
class PurchasingController extends Controller
{
    /**
     * Products at or below their reorder point (not overstocked) with a suggested order quantity,
     * most critical first.
     */
    public function reorder(): JsonResponse
    {
        $rows = [];
        foreach (Inventory::loadProducts() as $p) {
            if ($p['sellable'] > $p['reorder_point'] || $p['status'] === 'OVERSTOCK') continue;
            $rows[] = ['id' => $p['id'], 'sku' => $p['sku'], 'name' => $p['name'], 'current' => $p['sellable'], 'on_order' => $p['on_order'], 'reorder_point' => $p['reorder_point'], 'suggested_qty' => $p['suggested_qty'],
                'priority' => in_array($p['status'], ['OUT', 'CRITICAL'], true) ? 'CRITICAL' : 'HIGH', 'supplier_id' => $p['supplier_id'], 'supplier' => $p['supplier_name'],
                'unit_cost' => $p['unit_cost'], 'in_season_window' => $p['in_season_window'], 'max_stock' => $p['max_stock']];
        }
        usort($rows, fn ($a, $b) => $a['priority'] === $b['priority'] ? $a['current'] <=> $b['current'] : ($a['priority'] === 'CRITICAL' ? -1 : 1));
        return response()->json($rows);
    }

    // ---- suppliers ----------------------------------------------------------
    private static function supOut(array $s): array
    {
        return $s + ['open_pos' => Db::count("SELECT COUNT(*) c FROM purchase_orders WHERE supplier_id = ? AND status IN ('draft','sent')", [$s['id']]), 'total_pos' => Db::count('SELECT COUNT(*) c FROM purchase_orders WHERE supplier_id = ?', [$s['id']])];
    }

    public function suppliers(): JsonResponse
    {
        return response()->json(array_map([self::class, 'supOut'], Db::all('SELECT * FROM suppliers ORDER BY name')));
    }

    public function supplier(int $id): JsonResponse
    {
        $s = Db::get('SELECT * FROM suppliers WHERE id = ?', [$id]);
        if (!$s) throw HttpError::notFound('Supplier not found');
        $history = Db::all('SELECT o.id, o.code, o.status, o.created, o.expected, (SELECT SUM(qty*unit_cost) FROM po_items WHERE po_id = o.id) total FROM purchase_orders o WHERE supplier_id = ? ORDER BY id DESC', [$s['id']]);
        return response()->json(self::supOut($s) + ['history' => $history]);
    }

    private static function readSupplier(array $b, ?array $ex = null): array
    {
        $g = fn (string $k, $d = null) => array_key_exists($k, $b) ? $b[$k] : ($ex[$k] ?? $d);
        $email = V::str($g('email'), 'Email', 1, 120, true);
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) throw HttpError::bad('Enter a valid supplier email.');
        return [
            'name' => V::str($g('name'), 'Supplier name', 1, 120), 'contact' => V::str($g('contact'), 'Contact person', 1, 80, true), 'email' => $email,
            'phone' => V::str($g('phone'), 'Phone', 1, 30, true), 'lead_time_days' => V::int($g('lead_time_days', 14), 'Lead time (days)', 0, 365),
            'status' => V::oneOf($g('status', 'active'), 'Status', ['active', 'inactive']), 'notes' => V::str($g('notes'), 'Notes', 1, 300, true),
        ];
    }

    public function createSupplier(Request $request): JsonResponse
    {
        $s = self::readSupplier($request->all());
        if (Db::get('SELECT 1 x FROM suppliers WHERE lower(name) = lower(?)', [$s['name']])) throw HttpError::conflict('A supplier with that name already exists.');
        $id = Db::run('INSERT INTO suppliers(code, name, contact, email, phone, lead_time_days, status, notes) VALUES (?,?,?,?,?,?,?,?)', [Db::nextCode('suppliers', 'SUP', 3), $s['name'], $s['contact'], $s['email'], $s['phone'], $s['lead_time_days'], $s['status'], $s['notes']]);
        Audit::log($request->attributes->get('user'), 'SUPPLIER_CREATE', $s['name']);
        return response()->json(self::supOut(Db::get('SELECT * FROM suppliers WHERE id = ?', [$id])), 201);
    }

    public function updateSupplier(Request $request, int $id): JsonResponse
    {
        $ex = Db::get('SELECT * FROM suppliers WHERE id = ?', [$id]);
        if (!$ex) throw HttpError::notFound('Supplier not found');
        $s = self::readSupplier($request->all(), $ex);
        if (Db::get('SELECT 1 x FROM suppliers WHERE lower(name) = lower(?) AND id <> ?', [$s['name'], $ex['id']])) throw HttpError::conflict('A supplier with that name already exists.');
        Db::run('UPDATE suppliers SET name=?, contact=?, email=?, phone=?, lead_time_days=?, status=?, notes=? WHERE id=?', [$s['name'], $s['contact'], $s['email'], $s['phone'], $s['lead_time_days'], $s['status'], $s['notes'], $ex['id']]);
        Audit::log($request->attributes->get('user'), 'SUPPLIER_UPDATE', $s['name']);
        return response()->json(self::supOut(Db::get('SELECT * FROM suppliers WHERE id = ?', [$ex['id']])));
    }

    // ---- purchase orders ---------------------------------------------------
    private static function poOut(array $o): array
    {
        $items = Db::all('SELECT i.*, p.sku, p.name product FROM po_items i JOIN products p ON p.id = i.product_id WHERE po_id = ?', [$o['id']]);
        $sup = Db::get('SELECT name FROM suppliers WHERE id = ?', [$o['supplier_id']]);
        $inc = Db::get('SELECT id, code, status, expected_date FROM incoming WHERE po_id = ?', [$o['id']]);
        $units = 0; $total = 0.0;
        foreach ($items as $i) { $units += $i['qty']; $total += $i['qty'] * $i['unit_cost']; }
        return $o + ['supplier' => $sup['name'] ?? null, 'items' => $items, 'units' => $units, 'total' => $total, 'shipment' => $inc];
    }

    public function purchaseOrders(Request $request): JsonResponse
    {
        $where = $request->query('status') === 'open' ? "WHERE status IN ('draft','sent','partial')" : '';
        return response()->json(array_map([self::class, 'poOut'], Db::all("SELECT * FROM purchase_orders $where ORDER BY id DESC")));
    }

    public function purchaseOrder(int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Purchase order not found');
        return response()->json(self::poOut($o));
    }

    /**
     * Marks a PO as sent and creates its expected incoming shipment.
     */
    private static function openShipmentFor(array $po): void
    {
        $sup = Db::get('SELECT lead_time_days FROM suppliers WHERE id = ?', [$po['supplier_id']]);
        Db::run('INSERT INTO incoming(code, po_id, expected_date, status) VALUES (?,?,?,?)', [Db::nextCode('incoming', 'SHP'), $po['id'], $po['expected'] ?: Clock::addDays(Clock::today(), $sup['lead_time_days'] ?? 14), 'expected']);
        Db::run("UPDATE purchase_orders SET status = 'sent' WHERE id = ?", [$po['id']]);
    }

    /**
     * Creates (and optionally sends) a purchase order. An order that would push on-hand plus on-order stock
     * above the product maximum is rejected, which prevents the post-summer overstock.
     */
    public function createPurchaseOrder(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $sup = Db::get('SELECT * FROM suppliers WHERE id = ?', [V::int($request->input('supplier_id'), 'Supplier')]);
        if (!$sup) throw HttpError::bad('Supplier does not exist.');
        if ($sup['status'] !== 'active') throw HttpError::conflict('That supplier is inactive.');
        $lines = $request->input('items');
        if (!is_array($lines) || !count($lines)) throw HttpError::bad('Add at least one item.');
        $expected = V::date($request->input('expected'), 'Expected date', true);
        if ($expected && $expected < Clock::today()) throw HttpError::bad('Expected date cannot be in the past.');
        $prods = Inventory::loadProducts();
        $merged = [];
        foreach ($lines as $l) { $l = (array) $l; $pid = V::int($l['product_id'] ?? null, 'Product'); $merged[$pid] = ($merged[$pid] ?? 0) + V::int($l['qty'] ?? null, 'Quantity', 1, 1e6); }
        $notes = V::str($request->input('notes'), 'Notes', 1, 300, true);
        $send = (bool) $request->input('send');
        $warnings = [];
        $po = Db::tx(function () use ($merged, $prods, $sup, $user, $expected, $notes, $send, &$warnings) {
            foreach ($merged as $pid => $qty) {
                $p = null;
                foreach ($prods as $x) if ($x['id'] === $pid) { $p = $x; break; }
                if (!$p) throw HttpError::bad('A selected product does not exist.');
                $projected = $p['on_hand'] + $p['on_order'] + $qty;
                if ($projected > $p['max_stock']) throw HttpError::conflict("Ordering $qty × {$p['name']} would raise stock to $projected, above the maximum of {$p['max_stock']} (on hand {$p['on_hand']}, already on order {$p['on_order']}). Reduce the quantity. This prevents the post-summer overstock.", ['product_id' => $pid]);
                if ($p['suggested_qty'] > 0 && $qty > $p['suggested_qty'] * 1.5) $warnings[] = "{$p['name']}: ordering $qty is well above the suggested {$p['suggested_qty']}.";
                if ($p['suggested_qty'] === 0 && $p['sellable'] > $p['reorder_point']) $warnings[] = "{$p['name']}: stock is currently above its reorder point.";
            }
            $id = Db::run('INSERT INTO purchase_orders(code, supplier_id, status, created_by, created, expected, notes) VALUES (?,?,?,?,?,?,?)', [Db::nextCode('purchase_orders', 'PO'), $sup['id'], 'draft', $user['name'], Clock::nowTs(), $expected, $notes]);
            foreach ($merged as $pid => $qty) {
                $cost = 0;
                foreach ($prods as $x) if ($x['id'] === $pid) $cost = $x['unit_cost'];
                Db::run('INSERT INTO po_items(po_id, product_id, qty, unit_cost) VALUES (?,?,?,?)', [$id, $pid, $qty, $cost]);
            }
            if ($send) self::openShipmentFor(Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$id]));
            return Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$id]);
        });
        Audit::log($user, $send ? 'PO_SENT' : 'PO_CREATE', "{$po['code']} to {$sup['name']}");
        return response()->json(self::poOut($po) + ['warnings' => $warnings], 201);
    }

    /**
     * Sends a draft purchase order to the supplier and opens its incoming shipment.
     */
    public function sendPurchaseOrder(Request $request, int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Purchase order not found');
        if ($o['status'] !== 'draft') throw HttpError::conflict("{$o['code']} is {$o['status']}; only drafts can be sent.");
        Db::tx(fn () => self::openShipmentFor($o));
        Audit::log($request->attributes->get('user'), 'PO_SENT', $o['code']);
        return response()->json(self::poOut(Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$o['id']])));
    }

    /**
     * Cancels a draft or sent purchase order and removes its pending shipment.
     */
    public function cancelPurchaseOrder(Request $request, int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Purchase order not found');
        if (!in_array($o['status'], ['draft', 'sent'], true)) throw HttpError::conflict("{$o['code']} is {$o['status']} and cannot be cancelled.");
        Db::tx(function () use ($o) {
            Db::run("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?", [$o['id']]);
            Db::run("DELETE FROM incoming WHERE po_id = ? AND status IN ('expected','delayed')", [$o['id']]);
        });
        Audit::log($request->attributes->get('user'), 'PO_CANCEL', $o['code']);
        return response()->json(self::poOut(Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$o['id']])));
    }

    public function purchaseHistory(): JsonResponse
    {
        return response()->json(array_map([self::class, 'poOut'], Db::all("SELECT * FROM purchase_orders WHERE status IN ('received','cancelled') ORDER BY id DESC")));
    }

    // ---- incoming shipments ------------------------------------------------
    private static function incOut(array $s): array
    {
        $po = Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$s['po_id']]);
        $items = Db::all('SELECT i.product_id, i.qty expected, i.received_qty received, p.sku, p.name product, p.perishable, p.shelf_life_days, p.bin FROM po_items i JOIN products p ON p.id = i.product_id WHERE po_id = ?', [$s['po_id']]);
        $status = (in_array($s['status'], ['expected', 'delayed'], true) && $s['expected_date'] < Clock::today()) ? 'delayed' : $s['status'];
        $exp = array_sum(array_column($items, 'expected'));
        $rec = array_sum(array_column($items, 'received'));
        return $s + ['status' => $status, 'po_code' => $po['code'], 'supplier' => Db::get('SELECT name FROM suppliers WHERE id = ?', [$po['supplier_id']])['name'] ?? null, 'items' => $items,
            'days' => Clock::daysUntil($s['expected_date']), 'expected_units' => (int) $exp, 'received_units' => $s['received_date'] ? (int) $rec : null];
    }

    public function incoming(): JsonResponse
    {
        return response()->json(array_map([self::class, 'incOut'], Db::all("SELECT * FROM incoming ORDER BY CASE WHEN status IN ('expected','delayed') THEN 0 ELSE 1 END, expected_date")));
    }

    public function incomingOne(int $id): JsonResponse
    {
        $s = Db::get('SELECT * FROM incoming WHERE id = ?', [$id]);
        if (!$s) throw HttpError::notFound('Shipment not found');
        return response()->json(self::incOut($s));
    }

    /**
     * Receives a shipment: creates one batch per line with its own expiry date (default shelf life if blank),
     * logs a "Received" movement, and flags a variance when received differs from ordered.
     */
    public function receive(Request $request, int $id): JsonResponse
    {
        $user = $request->attributes->get('user');
        $s = Db::get('SELECT * FROM incoming WHERE id = ?', [$id]);
        if (!$s) throw HttpError::notFound('Shipment not found');
        if (!in_array($s['status'], ['expected', 'delayed'], true)) throw HttpError::conflict("{$s['code']} was already received.");
        $lines = $request->input('items');
        if (!is_array($lines)) throw HttpError::bad('Enter the received quantities.');
        $items = Db::all('SELECT i.*, p.perishable, p.shelf_life_days, p.bin, p.name FROM po_items i JOIN products p ON p.id = i.product_id WHERE po_id = ?', [$s['po_id']]);
        $po = Db::get('SELECT * FROM purchase_orders WHERE id = ?', [$s['po_id']]);
        $note = V::str($request->input('note'), 'Note', 1, 300, true);
        $variance = false;
        Db::tx(function () use ($items, $lines, $s, $po, $user, $note, &$variance) {
            foreach ($items as $it) {
                $l = null;
                foreach ($lines as $x) { $x = (array) $x; if ((int) ($x['product_id'] ?? 0) === $it['product_id']) { $l = $x; break; } }
                if (!$l) throw HttpError::bad("Enter the received quantity for {$it['name']}.");
                $q = V::int($l['received_qty'] ?? null, "Received quantity for {$it['name']}", 0, 1e6);
                if ($q !== $it['qty']) $variance = true;
                if ($q > 0) {
                    $expiry = null;
                    if ($it['perishable']) {
                        $expiry = !empty($l['expiry']) ? V::date($l['expiry'], "Expiry date for {$it['name']}") : Clock::addDays(Clock::today(), $it['shelf_life_days'] ?: 270);
                        if ($expiry <= Clock::today()) throw HttpError::bad("{$it['name']}: expiry date must be in the future.");
                    }
                    $bin = V::str($l['bin'] ?? null, 'Bin', 1, 20, true);
                    $b = Stock::newBatch($it['product_id'], $q, Clock::today(), $expiry, $bin ? strtoupper($bin) : $it['bin'], $s['po_id']);
                    Stock::logMovement($user, $it['product_id'], $b, 'Received', $q, "{$s['code']} / {$po['code']}", $q !== $it['qty'] ? "expected {$it['qty']}" : null);
                }
                Db::run('UPDATE po_items SET received_qty = ? WHERE id = ?', [$q, $it['id']]);
            }
            Db::run('UPDATE incoming SET status = ?, received_date = ?, received_by = ?, note = ? WHERE id = ?', [$variance ? 'variance' : 'received', Clock::today(), $user['name'], $note, $s['id']]);
            Db::run("UPDATE purchase_orders SET status = 'received' WHERE id = ?", [$s['po_id']]);
        });
        Audit::log($user, $variance ? 'SHIPMENT_RECEIVED_VARIANCE' : 'SHIPMENT_RECEIVED', "{$s['code']} ({$po['code']})");
        return response()->json(self::incOut(Db::get('SELECT * FROM incoming WHERE id = ?', [$s['id']])));
    }
}
