<?php

namespace App\Services;

use App\Support\Db;

/**
 * Key/value system settings. Values saved in the settings table override DEFAULTS.
 * expiry_warning_days: batches within this many days of expiry raise an alert (60).
 * service_level_z: z-score for safety stock (1.65 = about 95% service level).
 * demand_history_days: length of the demand history used for safety stock.
 */
class Settings
{
    public const DEFAULTS = [
        'company_name' => 'WalangBrownout Appliances',
        'expiry_warning_days' => '60',
        'service_level_z' => '1.65',
        'demand_history_days' => '90',
        'filter_shelf_life_months' => '9',
        'session_hours' => '12',
        'max_login_attempts' => '5',
        'lockout_minutes' => '10',
        'allow_self_registration' => 'true',
    ];

    public static function all(): array
    {
        $out = self::DEFAULTS;
        foreach (Db::all('SELECT skey, value FROM settings') as $r) $out[$r['skey']] = $r['value'];
        return $out;
    }

    public static function num(string $k): int { return (int) (self::all()[$k] ?? 0); }

    public static function float(string $k): float { return (float) (self::all()[$k] ?? 0); }

    public static function set(string $k, string $v): void
    {
        if (Db::get('SELECT 1 x FROM settings WHERE skey = ?', [$k])) Db::run('UPDATE settings SET value = ? WHERE skey = ?', [$v, $k]);
        else Db::run('INSERT INTO settings(skey, value) VALUES (?,?)', [$k, $v]);
    }
}
