<?php

namespace App\Http\Controllers;

use App\Services\Alerts;
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
 * Physical counts and discrepancies, stock adjustments (with approval) and the alert feed.
 */
class StockController extends Controller
{
    private static function countRow(array $c): array { return $c + ['diff' => $c['physical_qty'] - $c['system_qty']]; }
    private static function can(array $user, string $perm): bool { return Perms::roleHas($user['role'], $perm); }

    /**
     * All physical counts, newest first, with the difference from the system figure.
     */
    public function counts(): JsonResponse
    {
        return response()->json(array_map([self::class, 'countRow'], Db::all('SELECT c.*, p.sku, p.name product, p.bin FROM counts c JOIN products p ON p.id = c.product_id ORDER BY c.id DESC')));
    }

    /**
     * Count worksheet: every active product with its current system quantity and bin.
     */
    public function worksheet(): JsonResponse
    {
        return response()->json(array_map(fn ($p) => ['id' => $p['id'], 'sku' => $p['sku'], 'name' => $p['name'], 'bin' => $p['bin'], 'system_qty' => $p['on_hand']], Inventory::loadProducts()));
    }

    /**
     * Records a physical count. A matching count is resolved at once; a mismatch opens a discrepancy
     * (and an alert) instead of overwriting the system figure. A new count supersedes older unresolved ones.
     */
    public function storeCount(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $p = Inventory::loadProduct(V::int($request->input('product_id'), 'Product'));
        if (!$p) throw HttpError::notFound('Product not found');
        $physical = V::int($request->input('physical_qty'), 'Physical quantity', 0, 1e7);
        $note = V::str($request->input('note'), 'Note', 1, 300, true);
        $c = Db::tx(function () use ($p, $physical, $note, $user) {
            $code = Db::nextCode('counts', 'CNT');
            // a new count supersedes older unresolved counts of the same product
            Db::run("UPDATE counts SET status = 'resolved', resolution = ?, resolved_ts = ? WHERE product_id = ? AND status IN ('open','investigating')", ["Superseded by $code", Clock::nowTs(), $p['id']]);
            $status = $physical === $p['on_hand'] ? 'resolved' : 'open';
            $id = Db::run('INSERT INTO counts(code, product_id, system_qty, physical_qty, status, counted_by, ts, note, resolution, resolved_ts) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [$code, $p['id'], $p['on_hand'], $physical, $status, $user['name'], Clock::nowTs(), $note, $status === 'resolved' ? 'Matches system' : null, $status === 'resolved' ? Clock::nowTs() : null]);
            Stock::logMovement($user, $p['id'], null, 'Counted', $physical, $code, "system {$p['on_hand']}");
            return Db::get('SELECT * FROM counts WHERE id = ?', [$id]);
        });
        Audit::log($user, 'STOCK_COUNT', "{$p['sku']}: system {$p['on_hand']}, physical $physical");
        return response()->json(self::countRow($c), 201);
    }

    /**
     * Marks a discrepancy as under investigation and assigns it to someone.
     */
    public function investigate(Request $request, int $id): JsonResponse
    {
        $user = $request->attributes->get('user');
        $c = Db::get('SELECT * FROM counts WHERE id = ?', [$id]);
        if (!$c) throw HttpError::notFound('Count not found');
        if ($c['status'] === 'resolved') throw HttpError::conflict('This discrepancy is already resolved.');
        Db::run("UPDATE counts SET status = 'investigating', assigned_to = ? WHERE id = ?", [V::str($request->input('assigned_to'), 'Assignee', 1, 80, true) ?: $user['name'], $c['id']]);
        Audit::log($user, 'DISCREPANCY_INVESTIGATE', $c['code']);
        return response()->json(self::countRow(Db::get('SELECT * FROM counts WHERE id = ?', [$c['id']])));
    }

    /**
     * Closes a discrepancy: "adjust" corrects stock to the physical count (logged as a movement),
     * "dismiss" closes it without changing stock. A resolution note is required.
     */
    public function resolve(Request $request, int $id): JsonResponse
    {
        $user = $request->attributes->get('user');
        $c = Db::get('SELECT * FROM counts WHERE id = ?', [$id]);
        if (!$c) throw HttpError::notFound('Count not found');
        if ($c['status'] === 'resolved') throw HttpError::conflict('This discrepancy is already resolved.');
        $action = V::oneOf($request->input('action'), 'Action', ['adjust', 'dismiss']);
        $note = V::str($request->input('note'), 'Resolution note', 1, 300);
        Db::tx(function () use ($c, $action, $note, $user) {
            if ($action === 'adjust') {
                $p = Inventory::loadProduct($c['product_id']);
                $delta = $c['physical_qty'] - $p['on_hand'];
                if ($delta) Stock::applyDelta($user, $c['product_id'], $delta, 'Adjusted', $c['code'], "Discrepancy resolved: $note");
            }
            Db::run("UPDATE counts SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_ts = ? WHERE id = ?",
                [($action === 'adjust' ? 'Stock adjusted to physical count. ' : 'Dismissed. ') . $note, $user['name'], Clock::nowTs(), $c['id']]);
        });
        Audit::log($user, 'DISCREPANCY_RESOLVE', "{$c['code']} ($action)");
        return response()->json(self::countRow(Db::get('SELECT * FROM counts WHERE id = ?', [$c['id']])));
    }

    // ---- adjustments ------------------------------------------------------
    /**
     * Adjustment requests. Approvers see all; other roles see only their own.
     */
    public function adjustments(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $rows = Db::all('SELECT a.*, p.sku, p.name product FROM adjustments a JOIN products p ON p.id = a.product_id ORDER BY a.id DESC');
        return response()->json(self::can($user, 'adjust.approve') ? $rows : array_values(array_filter($rows, fn ($a) => $a['requested_by'] === $user['name'])));
    }

    /**
     * Creates a stock adjustment. Users with approval rights apply it immediately; others create a pending request.
     */
    public function storeAdjustment(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $p = Inventory::loadProduct(V::int($request->input('product_id'), 'Product'));
        if (!$p) throw HttpError::notFound('Product not found');
        $delta = V::int($request->input('delta'), 'Change (units)', -1e7, 1e7);
        if ($delta === 0) throw HttpError::bad('Change must not be zero.');
        if ($delta < 0 && -$delta > $p['on_hand']) throw HttpError::bad('Cannot remove ' . (-$delta) . "; only {$p['on_hand']} on hand.");
        $reason = V::str($request->input('reason'), 'Reason', 1, 300);
        $direct = self::can($user, 'adjust.approve');
        $out = Db::tx(function () use ($p, $delta, $reason, $direct, $user) {
            $code = Db::nextCode('adjustments', 'ADJ');
            $id = Db::run('INSERT INTO adjustments(code, product_id, delta, reason, status, requested_by, ts, decided_by, decided_ts) VALUES (?,?,?,?,?,?,?,?,?)',
                [$code, $p['id'], $delta, $reason, $direct ? 'approved' : 'pending', $user['name'], Clock::nowTs(), $direct ? $user['name'] : null, $direct ? Clock::nowTs() : null]);
            if ($direct) Stock::applyDelta($user, $p['id'], $delta, 'Adjusted', $code, $reason);
            return Db::get('SELECT * FROM adjustments WHERE id = ?', [$id]);
        });
        Audit::log($user, $direct ? 'ADJUSTMENT_APPLIED' : 'ADJUSTMENT_REQUESTED', "{$p['sku']} " . ($delta > 0 ? '+' : '') . "$delta: $reason");
        return response()->json($out, 201);
    }

    /**
     * Approves or rejects a pending adjustment; approval re-checks stock and applies the change.
     */
    private function decide(Request $request, int $id, bool $approve): JsonResponse
    {
        $user = $request->attributes->get('user');
        $a = Db::get('SELECT * FROM adjustments WHERE id = ?', [$id]);
        if (!$a) throw HttpError::notFound('Adjustment not found');
        if ($a['status'] !== 'pending') throw HttpError::conflict('This adjustment was already decided.');
        $note = V::str($request->input('note'), 'Note', 1, 300, true);
        Db::tx(function () use ($a, $approve, $note, $user) {
            if ($approve) {
                $p = Inventory::loadProduct($a['product_id']);
                if ($a['delta'] < 0 && -$a['delta'] > $p['on_hand']) throw HttpError::conflict("Only {$p['on_hand']} on hand now; cannot remove " . (-$a['delta']) . '.');
                Stock::applyDelta($user, $a['product_id'], $a['delta'], 'Adjusted', $a['code'], $a['reason']);
            }
            Db::run('UPDATE adjustments SET status = ?, decided_by = ?, decided_ts = ?, decision_note = ? WHERE id = ?', [$approve ? 'approved' : 'rejected', $user['name'], Clock::nowTs(), $note, $a['id']]);
        });
        Audit::log($user, $approve ? 'ADJUSTMENT_APPROVED' : 'ADJUSTMENT_REJECTED', $a['code']);
        return response()->json(Db::get('SELECT * FROM adjustments WHERE id = ?', [$a['id']]));
    }

    public function approve(Request $request, int $id): JsonResponse { return $this->decide($request, $id, true); }
    public function reject(Request $request, int $id): JsonResponse { return $this->decide($request, $id, false); }

    // ---- alerts -----------------------------------------------------------
    /**
     * Active alerts, optionally filtered by group. Sales sees only a limited-availability message;
     * warehouse does not see purchasing details.
     */
    public function alerts(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $list = Alerts::derive();
        $g = Alerts::GROUPS[$request->query('group')] ?? null;
        if ($g) $list = array_values(array_filter($list, fn ($a) => in_array($a['type'], $g, true)));
        if ($user['role'] === 'sales') {
            $list = array_values(array_map(fn ($a) => ['key' => $a['key'], 'type' => $a['type'], 'priority' => $a['priority'], 'sku' => $a['sku'], 'product' => $a['product'], 'title' => $a['title'], 'message' => "Limited availability: {$a['current']} unit(s) in stock.", 'state' => $a['state']],
                array_filter($list, fn ($a) => in_array($a['type'], ['low_stock', 'overstock'], true))));
        }
        if ($user['role'] === 'warehouse') {
            $list = array_values(array_map(function ($a) { if ($a['type'] === 'low_stock') unset($a['suggested_qty'], $a['supplier']); return $a; }, array_filter($list, fn ($a) => $a['type'] !== 'delayed')));
        }
        return response()->json($list);
    }

    /**
     * Sets the state of an alert. Discrepancies are resolved from the Discrepancies page and low-stock
     * alerts clear themselves once stock is replenished.
     */
    public function alertState(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $key = V::str($request->input('key'), 'Alert', 1, 80);
        $state = V::oneOf($request->input('state'), 'State', ['open', 'acknowledged', 'investigating', 'resolved']);
        $alert = null;
        foreach (Alerts::derive(true) as $a) if ($a['key'] === $key) { $alert = $a; break; }
        if (!$alert) throw HttpError::notFound('Alert is no longer active.');
        if ($alert['type'] === 'discrepancy' && $state === 'resolved') throw HttpError::conflict('Resolve a discrepancy from the Stock Discrepancies page, where the stock correction is recorded.');
        if ($alert['type'] === 'low_stock' && $state === 'resolved') throw HttpError::conflict('Low-stock alerts clear automatically once stock is replenished.');
        $note = V::str($request->input('note'), 'Note', 1, 300, true);
        if ($alert['type'] === 'discrepancy' && $state === 'investigating') {
            Db::run("UPDATE counts SET status = 'investigating', assigned_to = COALESCE(assigned_to, ?) WHERE id = ? AND status = 'open'", [$user['name'], $alert['count_id']]);
        }
        if (Db::get('SELECT 1 x FROM alert_states WHERE akey = ?', [$key])) Db::run('UPDATE alert_states SET state = ?, by_user = ?, ts = ?, note = ? WHERE akey = ?', [$state, $user['name'], Clock::nowTs(), $note, $key]);
        else Db::run('INSERT INTO alert_states(akey, state, by_user, ts, note) VALUES (?,?,?,?,?)', [$key, $state, $user['name'], Clock::nowTs(), $note]);
        Audit::log($user, 'ALERT_' . strtoupper($state), $key);
        return response()->json(['ok' => true]);
    }
}
