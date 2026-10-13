<?php

namespace App\Support;

use DateTimeImmutable;

class Clock
{
    public static function nowTs(): string { return date('Y-m-d H:i:s'); }
    public static function today(): string { return date('Y-m-d'); }

    public static function addDays(string $s, int $n): string
    {
        return (new DateTimeImmutable("$s 12:00:00"))->modify(($n >= 0 ? '+' : '') . "$n days")->format('Y-m-d');
    }

    /** Whole days from today until the date (negative if past); null for no date. */
    public static function daysUntil(?string $s): ?int
    {
        if (!$s) return null;
        $a = new DateTimeImmutable(self::today() . ' 12:00:00');
        $b = new DateTimeImmutable(substr($s, 0, 10) . ' 12:00:00');
        return (int) round(($b->getTimestamp() - $a->getTimestamp()) / 86400);
    }
}
