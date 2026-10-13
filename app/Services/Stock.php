<?php

namespace App\Services;

use App\Support\Clock;
use App\Support\Db;
use App\Support\HttpError;

/**
 * Writes to stock: movement log, FEFO/FIFO batch allocation, batch creation and signed adjustments.
 * Every change to a batch is recorded in the movements table, which is what makes stock verifiable at any moment.
 */
class Stock
{
    /**
     * Appends one row to the movement log (who, when, which batch, how many, and the reference such as an SO/PO/count code).
     */
    public static function logMovement(?array $user, int $productId, ?array $batch, string $type, int $qty, ?string $ref = null, ?string $note = null): void
    {
        Db::run('INSERT INTO movements(ts, product_id, batch_id, batch_code, type, qty, ref, user_id, user_name, note) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [Clock::nowTs(), $productId, $batch['id'] ?? null, $batch['code'] ?? null, $type, $qty, $ref, $user['id'] ?? null, $user['name'] ?? 'system', $note]);
    }

    /** FEFO/FIFO allocation. Expired batches are never allocated. @return array<int, array{batch:array, qty:int}> */
    public static function allocate(int $productId, int $qty): array
    {
        $t = Clock::today();
        $bs = array_values(array_filter(Db::all('SELECT * FROM batches WHERE product_id = ? AND qty > 0', [$productId]), fn ($b) => !($b['expiry'] && $b['expiry'] < $t)));
        usort($bs, [Inventory::class, 'fefoSort']);
        $need = $qty;
        $out = [];
        foreach ($bs as $b) {
            if ($need <= 0) break;
            $take = min($b['qty'], $need);
            $out[] = ['batch' => $b, 'qty' => $take];
            $need -= $take;
        }
        if ($need > 0) throw HttpError::conflict("Not enough in-date stock to allocate $qty unit(s) (short by $need).");
        return $out;
    }

    /**
     * Creates a batch for a received shipment with its own received date, expiry date and bin; returns the new batch row.
     */
    public static function newBatch(int $productId, int $qty, ?string $received = null, ?string $expiry = null, ?string $bin = null, ?int $poId = null): array
    {
        $code = Db::nextCode('batches', 'B', 4);
        $id = Db::run('INSERT INTO batches(code, product_id, qty, received, expiry, bin, po_id) VALUES (?,?,?,?,?,?,?)', [$code, $productId, $qty, $received ?? Clock::today(), $expiry, $bin, $poId]);
        return Db::get('SELECT * FROM batches WHERE id = ?', [$id]);
    }

    /** Apply a signed delta: positive goes into a batch, negative draws down FEFO. */
    public static function applyDelta(?array $user, int $productId, int $delta, string $type = 'Adjusted', ?string $ref = null, ?string $note = null, ?int $batchId = null): void
    {
        if ($delta === 0) return;
        if ($delta > 0) {
            $b = $batchId ? Db::get('SELECT * FROM batches WHERE id = ?', [$batchId]) : null;
            if ($b) Db::run('UPDATE batches SET qty = qty + ? WHERE id = ?', [$delta, $b['id']]);
            else {
                $p = Db::get('SELECT bin FROM products WHERE id = ?', [$productId]);
                $b = self::newBatch($productId, $delta, Clock::today(), null, $p['bin'] ?? null);
            }
            self::logMovement($user, $productId, $b, $type, $delta, $ref, $note);
            return;
        }
        $need = -$delta;
        if ($batchId) $bs = [Db::get('SELECT * FROM batches WHERE id = ?', [$batchId])];
        else { $bs = Db::all('SELECT * FROM batches WHERE product_id = ? AND qty > 0', [$productId]); usort($bs, [Inventory::class, 'fefoSort']); }
        foreach ($bs as $b) {
            if ($need <= 0 || !$b) break;
            $take = min($b['qty'], $need);
            Db::run('UPDATE batches SET qty = qty - ? WHERE id = ?', [$take, $b['id']]);
            self::logMovement($user, $productId, $b, $type, -$take, $ref, $note);
            $need -= $take;
        }
        if ($need > 0) throw HttpError::conflict('Adjustment would take stock below zero.');
    }
}
