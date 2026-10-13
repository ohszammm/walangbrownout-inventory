<?php

namespace App\Services;

use App\Support\Clock;
use App\Support\Db;

/**
 * Core inventory calculations: reorder points, safety stock, FEFO/FIFO ordering and the
 * live on-hand / reserved / available figures. Nothing here is stored as a running total;
 * every figure is recomputed from the batches, orders and movements tables, so it is
 * always current (this is what fixes the "Mystery Shrinkage" problem).
 */
class Inventory
{
    /** Minimum number of days with recorded demand before history is trusted for safety stock. */
    public const MIN_DEMAND_DAYS = 14;

    /**
     * Reorder point = average daily usage x lead time (days) + safety stock.
     * For seasonal products the usage is multiplied by season_mult starting one lead time
     * BEFORE the season opens, so the order is placed early enough (fixes the "Summer Crunch").
     *
     * @param array $p              product row
     * @param int|null $safetyStock effective safety stock; falls back to the stored value
     * @return array{reorder_point:int, effective_usage:int|float, in_season_window:bool}
     */
    public static function reorderCalc(array $p, ?\DateTimeImmutable $asOf = null, ?int $safetyStock = null): array
    {
        $asOf ??= new \DateTimeImmutable('now');
        $safety = $safetyStock ?? (int) $p['safety_stock'];
        $usage = (float) $p['avg_daily_usage'];
        $inSeason = false;
        if ($p['seasonal'] && $p['season_mult'] > 1 && $p['season_start']) {
            $y = (int) $asOf->format('Y');
            // true when $asOf falls between (season start - lead time) and the end of the season month
            $check = function (int $yy) use ($p, $asOf): bool {
                $start = (new \DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $yy, $p['season_start'])))->modify('-' . (int) $p['lead_time'] . ' days');
                $endMonth = (int) ($p['season_end'] ?: $p['season_start']);
                $end = (new \DateTimeImmutable(sprintf('%04d-%02d-01 23:59:59', $yy, $endMonth)))->modify('last day of this month');
                $end = $end->setTime(23, 59, 59);
                return $asOf >= $start && $asOf <= $end;
            };
            $inSeason = $check($y) || $check($y - 1);
            if ($inSeason) $usage = (float) round($p['avg_daily_usage'] * $p['season_mult']);
        }
        return [
            'reorder_point' => (int) round($usage * $p['lead_time'] + $safety),
            'effective_usage' => $usage == floor($usage) ? (int) $usage : $usage,
            'in_season_window' => $inSeason,
        ];
    }

    /**
     * Daily demand totals per product from the movement log (type 'Picked') over the last $days days.
     * Returns [product_id => ['days' => days with demand, 'sum' => units, 'sumsq' => sum of squares]],
     * which is all that is needed to get the standard deviation of daily demand.
     */
    public static function demandStats(int $days): array
    {
        $since = Clock::addDays(Clock::today(), -$days);
        $out = [];
        foreach (Db::all("SELECT product_id, SUBSTR(ts, 1, 10) AS d, SUM(-qty) AS q FROM movements WHERE type = 'Picked' AND qty < 0 AND ts >= ? GROUP BY product_id, SUBSTR(ts, 1, 10)", [$since]) as $r) {
            $s = $out[$r['product_id']] ?? ['days' => 0, 'sum' => 0.0, 'sumsq' => 0.0];
            $s['days']++;
            $s['sum'] += (float) $r['q'];
            $s['sumsq'] += (float) $r['q'] * (float) $r['q'];
            $out[$r['product_id']] = $s;
        }
        return $out;
    }

    /**
     * Safety stock = service-level factor (z) x standard deviation of daily demand x sqrt(lead time).
     * Days with no sales count as zero demand, so the window is always $days long. Products
     * with less than MIN_DEMAND_DAYS of history keep the planner's manual value instead.
     * The result is capped at the product's maximum stock.
     *
     * @return array{value:int, source:string, std_dev:float|null}  source is 'calculated' or 'manual'
     */
    public static function safetyStock(array $p, ?array $stat, int $days, float $z): array
    {
        $manual = ['value' => (int) $p['safety_stock'], 'source' => 'manual', 'std_dev' => null];
        if (!$stat || $stat['days'] < self::MIN_DEMAND_DAYS || $days < 2) return $manual;
        $mean = $stat['sum'] / $days;
        $sd = sqrt(max(0.0, ($stat['sumsq'] - $days * $mean * $mean) / ($days - 1)));
        $value = (int) ceil($z * $sd * sqrt(max(1, (int) $p['lead_time'])));
        return ['value' => min($value, (int) $p['max_stock']), 'source' => 'calculated', 'std_dev' => round($sd, 2)];
    }

    /** FEFO for expiring stock, FIFO (oldest received) for non-expiring. */
    public static function fefoSort(array $a, array $b): int
    {
        if ($a['expiry'] && $b['expiry'] && $a['expiry'] !== $b['expiry']) return $a['expiry'] < $b['expiry'] ? -1 : 1;
        if ($a['expiry'] && !$b['expiry']) return -1;
        if (!$a['expiry'] && $b['expiry']) return 1;
        if ($a['received'] !== $b['received']) return $a['received'] < $b['received'] ? -1 : 1;
        return $a['id'] <=> $b['id'];
    }

    /** In-stock batches of a product in recommended pick order, flagged expired and with days left. */
    public static function batchesFor(int $productId): array
    {
        $t = Clock::today();
        $rows = Db::all('SELECT * FROM batches WHERE product_id = ? AND qty > 0', [$productId]);
        usort($rows, [self::class, 'fefoSort']);
        foreach ($rows as $i => &$b) {
            $b['expired'] = (bool) ($b['expiry'] && $b['expiry'] < $t);
            $b['days_left'] = Clock::daysUntil($b['expiry']);
            $b['pick_order'] = $i + 1;
        }
        return $rows;
    }

    /** Stock status label from on-hand vs. maximum, safety stock and reorder point (OUT/OVERSTOCK/CRITICAL/LOW/WATCH/OK). */
    public static function stockStatus(float $onHand, float $rop, float $max, float $safety): string
    {
        if ($onHand <= 0) return 'OUT';
        if ($onHand > $max) return 'OVERSTOCK';
        if ($onHand <= $safety) return 'CRITICAL';
        if ($onHand < $rop) return 'LOW';
        if ($onHand < $rop * 1.25) return 'WATCH';
        return 'OK';
    }

    /** The newest unresolved physical count whose figure differs from the system figure, if any. */
    public static function openCountFor(int $productId): ?array
    {
        return Db::get("SELECT * FROM counts WHERE product_id = ? AND status IN ('open','investigating') AND physical_qty <> system_qty ORDER BY id DESC LIMIT 1", [$productId]);
    }

    /**
     * Loads every product with its live figures:
     *  - on_hand   = units physically in batches
     *  - reserved  = units on pending/picking sales orders
     *  - available = (in-date on-hand - reserved), also capped by an open physical count;
     *                this is the only figure the sales channel may sell against
     * plus reorder point, effective safety stock, status, suggested order qty and expiry info.
     * 'safety_stock' is the manual value stored on the product; 'safety_stock_effective' is the
     * value actually used (calculated from demand history when enough history exists).
     */
    public static function loadProducts(bool $includeInactive = false): array
    {
        $t = Clock::today();
        $cfg = Settings::all();
        $warn = (int) $cfg['expiry_warning_days'];
        $histDays = max(2, (int) $cfg['demand_history_days']);
        $z = (float) $cfg['service_level_z'];
        $demand = self::demandStats($histDays);
        $prods = Db::all('SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id ' . ($includeInactive ? '' : 'WHERE p.active = 1 ') . 'ORDER BY p.name');
        $batches = Db::all('SELECT * FROM batches WHERE qty > 0');
        $reserved = [];
        foreach (Db::all("SELECT i.product_id, SUM(i.qty) q FROM so_items i JOIN sales_orders o ON o.id = i.so_id WHERE o.status IN ('pending','picking') GROUP BY i.product_id") as $r) $reserved[$r['product_id']] = (int) $r['q'];
        $onOrder = [];
        foreach (Db::all("SELECT i.product_id, SUM(i.qty - i.received_qty) q FROM po_items i JOIN purchase_orders o ON o.id = i.po_id WHERE o.status IN ('sent','partial') GROUP BY i.product_id") as $r) $onOrder[$r['product_id']] = (int) $r['q'];

        $out = [];
        foreach ($prods as $p) {
            $bs = array_values(array_filter($batches, fn ($b) => $b['product_id'] == $p['id']));
            usort($bs, [self::class, 'fefoSort']);
            $onHand = array_sum(array_column($bs, 'qty'));
            $expiredQty = array_sum(array_map(fn ($b) => ($b['expiry'] && $b['expiry'] < $t) ? $b['qty'] : 0, $bs));
            $sellable = $onHand - $expiredQty;
            $res = $reserved[$p['id']] ?? 0;
            $available = max(0, $sellable - $res);
            $oc = self::openCountFor($p['id']);
            // never sell more than the physical count proved to exist
            if ($oc && $oc['physical_qty'] < $oc['system_qty']) $available = min($available, max(0, $oc['physical_qty'] - $res));
            $ss = self::safetyStock($p, $demand[$p['id']] ?? null, $histDays, $z);
            $rc = self::reorderCalc($p, null, $ss['value']);
            $expiringQty = 0;
            foreach ($bs as $b) if ($b['expiry'] && $b['expiry'] >= $t && Clock::daysUntil($b['expiry']) <= $warn) $expiringQty += $b['qty'];
            $status = self::stockStatus($sellable, $rc['reorder_point'], $p['max_stock'], $ss['value']);
            $target = min($p['max_stock'], (int) round($rc['reorder_point'] * 2));
            $suggested = max(0, $target - $sellable - ($onOrder[$p['id']] ?? 0));
            $next = null;
            foreach ($bs as $b) if (!($b['expiry'] && $b['expiry'] < $t)) { $next = $b; break; }
            $p['perishable'] = (bool) $p['perishable'];
            $p['seasonal'] = (bool) $p['seasonal'];
            $out[] = array_merge($p, $rc, [
                'safety_stock_effective' => $ss['value'], 'safety_stock_source' => $ss['source'], 'demand_std_dev' => $ss['std_dev'],
                'on_hand' => (int) $onHand, 'sellable' => (int) $sellable, 'expired_qty' => (int) $expiredQty, 'reserved' => $res, 'available' => (int) $available,
                'status' => $status, 'on_order' => $onOrder[$p['id']] ?? 0, 'suggested_qty' => (int) $suggested, 'expiring_qty' => (int) $expiringQty,
                'nearest_expiry' => $next['expiry'] ?? null, 'batch_count' => count($bs),
                'discrepancy' => $oc ? ['id' => $oc['id'], 'code' => $oc['code'], 'system_qty' => $oc['system_qty'], 'physical_qty' => $oc['physical_qty'], 'diff' => $oc['physical_qty'] - $oc['system_qty']] : null,
                'availability' => $available <= 0 ? 'Out of Stock' : (($available <= max($ss['value'], $rc['reorder_point'] * 0.5) || $status === 'LOW' || $status === 'CRITICAL') ? 'Low Stock' : 'Available'),
            ]);
        }
        return $out;
    }

    /** One product with live figures (includes inactive products), or null if it does not exist. */
    public static function loadProduct(int $id): ?array
    {
        foreach (self::loadProducts(true) as $p) if ($p['id'] == $id) return $p;
        return null;
    }
}
