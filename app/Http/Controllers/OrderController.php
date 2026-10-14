<?php

namespace App\Http\Controllers;

use App\Services\Audit;
use App\Services\Inventory;
use App\Services\Perms;
use App\Services\Stock;
use App\Support\Clock;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\V;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sales orders and the warehouse flow: create (reserves stock) -> start pick -> complete pick (deducts stock) -> ship.
 */
class OrderController extends Controller
{
    /**
     * Adds the order lines, total value and unit count to an order row.
     */
    private static function withItems(array $o): array
    {
        $items = Db::all('SELECT i.*, p.sku, p.name product FROM so_items i JOIN products p ON p.id = i.product_id WHERE so_id = ?', [$o['id']]);
        $total = 0.0; $units = 0;
        foreach ($items as $i) { $total += $i['qty'] * $i['price']; $units += $i['qty']; }
        return $o + ['items' => $items, 'total' => $total, 'units' => $units];
    }

    /**
     * Sales orders, filtered by scope (active / history) and a search on code or customer.
     */
    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope');
        $where = $scope === 'history' ? "WHERE status IN ('shipped','cancelled')" : ($scope === 'active' ? "WHERE status IN ('pending','picking','ready')" : '');
        $q = strtolower((string) $request->query('q', ''));
        $rows = array_map([self::class, 'withItems'], Db::all("SELECT * FROM sales_orders $where ORDER BY id DESC"));
        return response()->json(array_values(array_filter($rows, fn ($o) => $q === '' || str_contains(strtolower($o['code'] . ' ' . $o['customer']), $q))));
    }

    /**
     * One order with its lines and the batches picked for it.
     */
    public function show(int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Order not found');
        return response()->json(self::withItems($o) + ['picks' => Db::all('SELECT * FROM so_picks WHERE so_id = ?', [$o['id']])]);
    }

    /**
     * Creates a sales order. Each line is checked against AVAILABLE quantity (on-hand minus reserved),
     * so overselling is rejected. A pending order immediately counts as reserved stock.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $customer = V::str($request->input('customer'), 'Customer name', 1, 100);
        $phone = V::str($request->input('phone'), 'Phone', 1, 30, true);
        $address = V::str($request->input('address'), 'Delivery address', 1, 200, true);
        $lines = $request->input('items');
        if (!is_array($lines) || !count($lines)) throw HttpError::bad('Add at least one item.');
        if (count($lines) > 50) throw HttpError::bad('Too many lines.');
        $merged = [];
        foreach ($lines as $l) {
            $l = (array) $l;
            $pid = V::int($l['product_id'] ?? null, 'Product');
            $q = V::int($l['qty'] ?? null, 'Quantity', 1, 100000);
            $merged[$pid] = ($merged[$pid] ?? 0) + $q;
        }
        $note = V::str($request->input('note'), 'Note', 1, 300, true);
        $o = Db::tx(function () use ($merged, $customer, $phone, $address, $user, $note) {
            $prods = Inventory::loadProducts();
            foreach ($merged as $pid => $qty) {
                $p = null;
                foreach ($prods as $x) if ($x['id'] === $pid) { $p = $x; break; }
                if (!$p) throw HttpError::bad('A selected product does not exist.');
                if ($qty > $p['available']) {
                    $a = $p['available'];
                    throw HttpError::conflict("⚠ Insufficient stock: only $a unit" . ($a === 1 ? '' : 's') . " of {$p['name']} " . ($a === 1 ? 'is' : 'are') . ' currently available.', ['product_id' => $pid, 'available' => $a]);
                }
            }
            $code = Db::nextCode('sales_orders', 'SO');
            $id = Db::run('INSERT INTO sales_orders(code, customer, phone, address, status, created_by, created, note) VALUES (?,?,?,?,?,?,?,?)', [$code, $customer, $phone, $address, 'pending', $user['name'], Clock::nowTs(), $note]);
            foreach ($merged as $pid => $qty) {
                $price = 0;
                foreach ($prods as $x) if ($x['id'] === $pid) $price = $x['price'];
                Db::run('INSERT INTO so_items(so_id, product_id, qty, price) VALUES (?,?,?,?)', [$id, $pid, $qty, $price]);
            }
            return Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        });
        Audit::log($user, 'SALES_ORDER_CREATE', "{$o['code']} for $customer");
        return response()->json(self::withItems($o), 201);
    }

    /**
     * Cancels a pending order, which releases its reserved quantity.
     */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Order not found');
        if ($o['status'] !== 'pending') throw HttpError::conflict("Order {$o['code']} is already {$o['status']} and can no longer be cancelled by Sales.");
        Db::run("UPDATE sales_orders SET status = 'cancelled' WHERE id = ?", [$o['id']]);
        Audit::log($request->attributes->get('user'), 'SALES_ORDER_CANCEL', $o['code']);
        return response()->json(self::withItems(Db::get('SELECT * FROM sales_orders WHERE id = ?', [$o['id']])));
    }

    // ---- pick orders (warehouse) -----------------------------------------
    /**
     * Pick list for pending/picking orders with the recommended batches per line: nearest expiry first (FEFO),
     * oldest received first for non-expiring items. Expired batches are skipped.
     */
    public function pickOrders(): JsonResponse
    {
        $orders = array_map([self::class, 'withItems'], Db::all("SELECT * FROM sales_orders WHERE status IN ('pending','picking') ORDER BY id"));
        foreach ($orders as &$o) {
            foreach ($o['items'] as &$i) {
                $need = $i['qty'];
                $plan = [];
                foreach (Inventory::batchesFor($i['product_id']) as $b) {
                    if ($b['expired']) continue;
                    if ($need <= 0) break;
                    $t = min($need, $b['qty']);
                    $plan[] = ['batch_id' => $b['id'], 'batch' => $b['code'], 'bin' => $b['bin'], 'qty' => $t, 'expiry' => $b['expiry'], 'method' => $b['expiry'] ? 'FEFO' : 'FIFO'];
                    $need -= $t;
                }
                $i['plan'] = $plan;
                $i['short'] = max(0, $need);
            }
            unset($i);
        }
        unset($o);
        return response()->json($orders);
    }

    /**
     * Moves a pending order to Picking.
     */
    public function startPick(Request $request, int $id): JsonResponse
    {
        $o = Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Order not found');
        if ($o['status'] !== 'pending') throw HttpError::conflict("Order {$o['code']} is {$o['status']}; it cannot be started.");
        Db::run("UPDATE sales_orders SET status = 'picking' WHERE id = ?", [$o['id']]);
        Audit::log($request->attributes->get('user'), 'PICK_START', $o['code']);
        return response()->json(['ok' => true]);
    }

    /**
     * Completes picking: allocates batches by FEFO/FIFO, deducts on-hand quantity, logs "Picked" movements
     * and moves the order to Ready. The stock leaves on-hand and the reservation ends at the same moment.
     */
    public function completePick(Request $request, int $id): JsonResponse
    {
        $user = $request->attributes->get('user');
        $o = Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Order not found');
        if ($o['status'] !== 'picking') throw HttpError::conflict("Order {$o['code']} must be in Picking status (currently {$o['status']}).");
        Db::tx(function () use ($o, $user) {
            foreach (Db::all('SELECT * FROM so_items WHERE so_id = ?', [$o['id']]) as $i) {
                foreach (Stock::allocate($i['product_id'], $i['qty']) as $a) {
                    Db::run('UPDATE batches SET qty = qty - ? WHERE id = ?', [$a['qty'], $a['batch']['id']]);
                    Db::run('INSERT INTO so_picks(so_id, product_id, batch_id, batch_code, qty, bin) VALUES (?,?,?,?,?,?)', [$o['id'], $i['product_id'], $a['batch']['id'], $a['batch']['code'], $a['qty'], $a['batch']['bin']]);
                    Stock::logMovement($user, $i['product_id'], $a['batch'], 'Picked', -$a['qty'], $o['code']);
                }
            }
            Db::run("UPDATE sales_orders SET status = 'ready' WHERE id = ?", [$o['id']]);
        });
        Audit::log($user, 'PICK_COMPLETE', $o['code']);
        return response()->json(self::withItems(Db::get('SELECT * FROM sales_orders WHERE id = ?', [$o['id']])));
    }

    // ---- outgoing shipments ---------------------------------------------------
    /**
     * Outgoing shipments list; sales users get a reduced view without lines or values.
     */
    public function outgoing(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $rows = array_map([self::class, 'withItems'], Db::all("SELECT * FROM sales_orders WHERE status <> 'cancelled' ORDER BY CASE status WHEN 'ready' THEN 0 WHEN 'picking' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, id DESC"));
        if ($user['role'] === 'sales') $rows = array_map(fn ($o) => ['id' => $o['id'], 'code' => $o['code'], 'customer' => $o['customer'], 'status' => $o['status'], 'created' => $o['created'], 'shipped' => $o['shipped'], 'units' => $o['units']], $rows);
        return response()->json($rows);
    }

    /**
     * Ships a Ready order and logs the "Shipped" movements.
     */
    public function ship(Request $request, int $id): JsonResponse
    {
        $user = $request->attributes->get('user');
        $o = Db::get('SELECT * FROM sales_orders WHERE id = ?', [$id]);
        if (!$o) throw HttpError::notFound('Order not found');
        if ($o['status'] !== 'ready') throw HttpError::conflict("Order {$o['code']} is {$o['status']}; only packed (Ready) orders can ship.");
        Db::tx(function () use ($o, $user) {
            Db::run("UPDATE sales_orders SET status = 'shipped', shipped = ? WHERE id = ?", [Clock::nowTs(), $o['id']]);
            foreach (Db::all('SELECT * FROM so_picks WHERE so_id = ?', [$o['id']]) as $p) Stock::logMovement($user, $p['product_id'], ['id' => $p['batch_id'], 'code' => $p['batch_code']], 'Shipped', $p['qty'], $o['code']);
        });
        Audit::log($user, 'SHIPMENT_SHIPPED', $o['code']);
        return response()->json(self::withItems(Db::get('SELECT * FROM sales_orders WHERE id = ?', [$o['id']])));
    }
}
