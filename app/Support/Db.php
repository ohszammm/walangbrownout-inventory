<?php

namespace App\Support;

use Illuminate\Support\Facades\DB as Conn;

/** Thin helpers so queries read like plain SQL and return plain arrays. */
class Db
{
    public static function all(string $sql, array $p = []): array
    {
        return array_map(fn ($r) => (array) $r, Conn::select($sql, $p));
    }

    public static function get(string $sql, array $p = []): ?array
    {
        return self::all($sql, $p)[0] ?? null;
    }

    /** Executes a statement; returns the last insert id (meaningful after INSERT). */
    public static function run(string $sql, array $p = []): int
    {
        Conn::statement($sql, $p);
        return (int) Conn::getPdo()->lastInsertId();
    }

    public static function count(string $sql, array $p = []): int
    {
        $r = self::get($sql, $p);
        return $r ? (int) array_values($r)[0] : 0;
    }

    /** Re-entrant transaction. */
    public static function tx(callable $fn)
    {
        return Conn::transaction($fn);
    }

    public static function nextCode(string $table, string $prefix, int $width = 4): string
    {
        $n = self::count("SELECT COUNT(*) c FROM $table") + 1;
        do {
            $code = $prefix . '-' . str_pad((string) $n++, $width, '0', STR_PAD_LEFT);
        } while (self::get("SELECT 1 x FROM $table WHERE code = ?", [$code]));
        return $code;
    }
}
