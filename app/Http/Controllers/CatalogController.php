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

class CatalogController extends Controller
{
    public const MOVE_TYPES = ['Received', 'Picked', 'Shipped', 'Counted', 'Transferred', 'Adjusted'];
    private const COLS = ['sku', 'name', 'category', 'class', 'perishable', 'shelf_life_days', 'seasonal', 'season_start', 'season_end', 'season_mult', 'avg_daily_usage', 'lead_time', 'safety_stock', 'max_stock', 'unit_cost', 'price', 'supplier_id', 'bin'];

    private static function strip(array $p, string $role): array
    {
        if (in_array($role, ['sales', 'warehouse'], true)) unset($p['unit_cost'], $p['supplier_name'], $p['supplier_id']);
        if ($role === 'sales') unset($p['reorder_point'], $p['safety_stock'], $p['max_stock'], $p['avg_daily_usage'], $p['lead_time'], $p['on_hand'], $p['reserved'], $p['bin'], $p['discrepancy'], $p['on_order'], $p['suggested_qty'], $p['effective_usage']);
        return $p;
    }

    private static function availabilityRow(array $p): array
    {
        return ['id' => $p['id'], 'sku' => $p['sku'], 'name' => $p['name'], 'category' => $p['category'], 'price' => $p['price'], 'available' => $p['available'], 'status' => $p['availability']];
    }

    private static function matches(array $p, string $q): bool
    {
        return $q === '' || str_contains(strtolower("{$p['sku']} {$p['name']} {$p['category']}"), $q);
    }

    public function availability(Request $request): JsonResponse
    {
        $q = strtolower((string) $request->query('q', ''));
        $rows = array_values(array_filter(Inventory::loadProducts(), fn ($p) => self::matches($p, $q)));
        return response()->json(array_map([self::class, 'availabilityRow'], $rows));
    }

    public function products(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $q = strtolower((string) $request->query('q', ''));
        $list = array_values(array_filter(Inventory::loadProducts(), fn ($p) => self::matches($p, $q)));
        return response()->json($user['role'] === 'sales' ? array_map([self::class, 'availabilityRow'], $list) : array_map(fn ($p) => self::strip($p, $user['role']), $list));
    }

    public function product(Request $request, string $sku): JsonResponse
    {
        $user = $request->attributes->get('user');
        if ($user['role'] === 'sales') throw HttpError::forbidden();
        $row = Db::get('SELECT id FROM products WHERE sku = ?', [$sku]);
        $p = $row ? Inventory::loadProduct($row['id']) : null;
        if (!$p) throw HttpError::notFound('Product not found');
        $out = self::strip($p, $user['role']);
        $out['batches'] = Inventory::batchesFor($p['id']);
        $out['movements'] = Db::all('SELECT * FROM movements WHERE product_id = ? ORDER BY id DESC LIMIT 25', [$p['id']]);
        return response()->json($out);
    }

    private static function readProduct(array $b, ?array $ex = null): array
    {
        $v = fn (string $k) => array_key_exists($k, $b) ? $b[$k] : ($ex[$k] ?? null);
        $perishable = V::bool($v('perishable'));
        $seasonal = V::bool($v('seasonal'));
        $out = [
            'sku' => strtoupper(V::str($v('sku'), 'SKU', 1, 30)),
            'name' => V::str($v('name'), 'Name', 1, 120),
            'category' => V::str($v('category'), 'Category', 1, 60),
            'class' => in_array($v('class'), ['A', 'B', 'C'], true) ? $v('class') : 'B',
            'perishable' => $perishable,
            'shelf_life_days' => $perishable ? V::int($v('shelf_life_days') ?? 270, 'Shelf life (days)', 1, 3650) : null,
            'seasonal' => $seasonal,
            'season_start' => $seasonal ? V::int($v('season_start'), 'Season start month', 1, 12) : null,
            'season_end' => $seasonal ? V::int($v('season_end'), 'Season end month', 1, 12) : null,
            'season_mult' => $seasonal ? V::num($v('season_mult') ?? 1, 'Seasonal multiplier', 1, 20) : 1,
            'avg_daily_usage' => V::num($v('avg_daily_usage'), 'Average daily usage', 0, 100000),
            'lead_time' => V::int($v('lead_time'), 'Lead time (days)', 0, 365),
            'safety_stock' => V::int($v('safety_stock'), 'Safety stock', 0, 1e6),
            'max_stock' => V::int($v('max_stock'), 'Maximum stock', 1, 1e7),
            'unit_cost' => V::num($v('unit_cost') ?? 0, 'Unit cost', 0, 1e8),
            'price' => V::num($v('price') ?? 0, 'Selling price', 0, 1e8),
            'supplier_id' => $v('supplier_id') ? V::int($v('supplier_id'), 'Supplier') : null,
            'bin' => V::str($v('bin'), 'Bin location', 1, 20, true),
        ];
        if ($out['safety_stock'] > $out['max_stock']) throw HttpError::bad('Safety stock cannot exceed maximum stock.');
        if ($out['supplier_id'] && !Db::get('SELECT 1 x FROM suppliers WHERE id = ?', [$out['supplier_id']])) throw HttpError::bad('Supplier does not exist.');
        return $out;
    }

    public function createProduct(Request $request): JsonResponse
    {
        $p = self::readProduct($request->all());
        if (Db::get('SELECT 1 x FROM products WHERE sku = ?', [$p['sku']])) throw HttpError::conflict("SKU {$p['sku']} already exists.");
        $id = Db::run('INSERT INTO products(' . implode(',', self::COLS) . ') VALUES (' . implode(',', array_fill(0, count(self::COLS), '?')) . ')', array_map(fn ($c) => $p[$c], self::COLS));
        Audit::log($request->attributes->get('user'), 'PRODUCT_CREATE', "{$p['sku']} {$p['name']}");
        return response()->json(Inventory::loadProduct($id), 201);
    }

    public function updateProduct(Request $request, int $id): JsonResponse
    {
        $ex = Db::get('SELECT * FROM products WHERE id = ?', [$id]);
        if (!$ex) throw HttpError::notFound('Product not found');
        $p = self::readProduct($request->all(), $ex);
        if ($p['sku'] !== $ex['sku'] && Db::get('SELECT 1 x FROM products WHERE sku = ?', [$p['sku']])) throw HttpError::conflict("SKU {$p['sku']} already exists.");
        Db::run('UPDATE products SET ' . implode(',', array_map(fn ($c) => "$c = ?", self::COLS)) . ' WHERE id = ?', [...array_map(fn ($c) => $p[$c], self::COLS), $ex['id']]);
        Audit::log($request->attributes->get('user'), 'PRODUCT_UPDATE', $p['sku']);
        return response()->json(Inventory::loadProduct($ex['id']));
    }

    public function deleteProduct(Request $request, int $id): JsonResponse
    {
        $p = Inventory::loadProduct($id);
        if (!$p) throw HttpError::notFound('Product not found');
        if ($p['on_hand'] > 0) throw HttpError::conflict("{$p['sku']} still has {$p['on_hand']} unit(s) on hand. Adjust stock to zero before deleting.");
        if (Db::get("SELECT 1 x FROM so_items i JOIN sales_orders o ON o.id = i.so_id WHERE i.product_id = ? AND o.status IN ('pending','picking','ready')", [$p['id']])) throw HttpError::conflict('Product is on open sales orders.');
        Db::run('UPDATE products SET active = 0 WHERE id = ?', [$p['id']]);
        Audit::log($request->attributes->get('user'), 'PRODUCT_DELETE', $p['sku']);
        return response()->json(['ok' => true]);
    }

    private static function batchStatus(array $b): string
    {
        $d = Clock::daysUntil($b['expiry']);
        if ($b['expiry'] && $b['expiry'] < Clock::today()) return 'Expired';
        return ($b['expiry'] && $d <= 30) ? 'Expiring' : 'Good';
    }

    public function batches(): JsonResponse
    {
        $rows = Db::all('SELECT b.*, p.sku, p.name product, p.perishable, p.bin pbin FROM batches b JOIN products p ON p.id = b.product_id WHERE b.qty > 0 AND p.active = 1 ORDER BY p.name');
        $rank = [];
        foreach (array_unique(array_column($rows, 'product_id')) as $pid) foreach (Inventory::batchesFor($pid) as $b) $rank[$b['id']] = $b['pick_order'];
        return response()->json(array_map(fn ($b) => $b + ['days_left' => Clock::daysUntil($b['expiry']), 'status' => self::batchStatus($b), 'pick_order' => $rank[$b['id']] ?? null, 'method' => $b['expiry'] ? 'FEFO' : 'FIFO'], $rows));
    }

    public function batch(int $id): JsonResponse
    {
        $b = Db::get('SELECT b.*, p.sku, p.name product, p.perishable FROM batches b JOIN products p ON p.id = b.product_id WHERE b.id = ?', [$id]);
        if (!$b) throw HttpError::notFound('Batch not found');
        return response()->json($b + ['days_left' => Clock::daysUntil($b['expiry']), 'status' => self::batchStatus($b), 'movements' => Db::all('SELECT * FROM movements WHERE batch_id = ? ORDER BY id DESC LIMIT 30', [$b['id']])]);
    }

    public function movements(Request $request): JsonResponse
    {
        $type = in_array($request->query('type'), self::MOVE_TYPES, true) ? $request->query('type') : null;
        $rows = Db::all('SELECT m.*, p.sku, p.name product FROM movements m JOIN products p ON p.id = m.product_id ' . ($type ? 'WHERE m.type = ? ' : '') . 'ORDER BY m.id DESC LIMIT 300', $type ? [$type] : []);
        return response()->json($rows);
    }

    public function transfer(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $b = Db::get('SELECT b.*, p.name pname FROM batches b JOIN products p ON p.id = b.product_id WHERE b.id = ?', [V::int($request->input('batch_id'), 'Batch')]);
        if (!$b) throw HttpError::notFound('Batch not found');
        $to = strtoupper(V::str($request->input('to_bin'), 'Destination bin', 1, 20));
        if ($to === $b['bin']) throw HttpError::bad('Batch is already in that bin.');
        $note = V::str($request->input('note'), 'Note', 1, 200, true);
        Db::tx(function () use ($b, $to, $user, $note) {
            Db::run('UPDATE batches SET bin = ? WHERE id = ?', [$to, $b['id']]);
            Stock::logMovement($user, $b['product_id'], $b, 'Transferred', $b['qty'], ($b['bin'] ?: 'unassigned') . " → $to", $note);
        });
        Audit::log($user, 'STOCK_TRANSFER', "{$b['code']} " . ($b['bin'] ?: 'unassigned') . " → $to");
        return response()->json(['ok' => true]);
    }
}
