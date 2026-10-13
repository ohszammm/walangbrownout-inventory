<?php

namespace App\Services;

use App\Support\Clock;
use App\Support\Db;

class Audit
{
    public static function log(?array $user, string $action, string $detail = ''): void
    {
        Db::run('INSERT INTO audit_logs(ts, user_id, user_name, role, action, detail) VALUES (?,?,?,?,?,?)',
            [Clock::nowTs(), $user['id'] ?? null, $user['name'] ?? 'system', $user['role'] ?? null, $action, $detail]);
    }
}
