<?php

namespace App\Support;

/** Small input validators that mirror the messages the React app expects. */
class V
{
    private static function blank($v): bool { return $v === null || $v === ''; }

    public static function str($v, string $name, int $min = 1, int $max = 200, bool $optional = false): ?string
    {
        if (self::blank($v)) {
            if ($optional) return null;
            throw HttpError::bad("$name is required.");
        }
        if (is_array($v)) throw HttpError::bad("$name is invalid.");
        $s = trim((string) $v);
        if (mb_strlen($s) < $min) {
            if ($optional && $s === '') return null;
            throw HttpError::bad("$name is required.");
        }
        if (mb_strlen($s) > $max) throw HttpError::bad("$name is too long (max $max).");
        return $s;
    }

    public static function int($v, string $name, int $min = 0, int|float $max = 1e9, bool $optional = false): ?int
    {
        if (self::blank($v)) {
            if ($optional) return null;
            throw HttpError::bad("$name is required.");
        }
        if (is_bool($v) || !is_numeric($v) || (float) $v != floor((float) $v)) throw HttpError::bad("$name must be a whole number.");
        $n = (int) $v;
        if ($n < $min) throw HttpError::bad("$name must be at least $min.");
        if ($n > $max) throw HttpError::bad("$name must be at most " . (int) $max . '.');
        return $n;
    }

    public static function num($v, string $name, float $min = 0, float $max = 1e9, bool $optional = false): ?float
    {
        if (self::blank($v)) {
            if ($optional) return null;
            throw HttpError::bad("$name is required.");
        }
        if (is_bool($v) || !is_numeric($v)) throw HttpError::bad("$name must be a number.");
        $n = (float) $v;
        if ($n < $min || $n > $max) throw HttpError::bad("$name is out of range.");
        return $n;
    }

    public static function date($v, string $name, bool $optional = false): ?string
    {
        if (self::blank($v)) {
            if ($optional) return null;
            throw HttpError::bad("$name is required.");
        }
        if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) || !checkdate((int) substr($v, 5, 2), (int) substr($v, 8, 2), (int) substr($v, 0, 4))) {
            throw HttpError::bad("$name must be a valid date (YYYY-MM-DD).");
        }
        return $v;
    }

    public static function oneOf($v, string $name, array $list, bool $optional = false): ?string
    {
        if (self::blank($v) && $optional) return null;
        if (!is_string($v) || !in_array($v, $list, true)) throw HttpError::bad("$name must be one of: " . implode(', ', $list) . '.');
        return $v;
    }

    public static function bool($v): int
    {
        return ($v === true || $v === 1 || $v === '1' || $v === 'true') ? 1 : 0;
    }
}
