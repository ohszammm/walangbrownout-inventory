<?php

namespace App\Http\Controllers;

use App\Services\Audit;
use App\Services\Perms;
use App\Services\Settings;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\V;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    private const STATUSES = ['active', 'disabled', 'pending'];

    private static function userOut(array $u): array
    {
        return ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'status' => $u['status'], 'photo' => AuthController::photoUrl((int) $u['id']), 'created_at' => $u['created_at'], 'last_login' => $u['last_login']];
    }

    public function users(): JsonResponse
    {
        return response()->json(array_map([self::class, 'userOut'], Db::all('SELECT * FROM users ORDER BY id')));
    }

    public function createUser(Request $request): JsonResponse
    {
        $name = V::str($request->input('name'), 'Name', 1, 80);
        $email = strtolower(V::str($request->input('email'), 'Email', 1, 120));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw HttpError::bad('Enter a valid email address.');
        $role = V::oneOf($request->input('role'), 'Role', array_keys(Perms::ROLES));
        AuthController::checkPassword($request->input('password'));
        if (Db::get('SELECT 1 x FROM users WHERE lower(email) = ?', [$email])) throw HttpError::conflict('An account with that email already exists.');
        $id = Db::run('INSERT INTO users(name, email, password_hash, role, status, created_at) VALUES (?,?,?,?,?,?)', [$name, $email, Hash::make($request->input('password')), $role, 'active', gmdate('c')]);
        Audit::log($request->attributes->get('user'), 'USER_CREATE', "$email as $role");
        return response()->json(self::userOut(Db::get('SELECT * FROM users WHERE id = ?', [$id])), 201);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $me = $request->attributes->get('user');
        $u = Db::get('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$u) throw HttpError::notFound('User not found');
        $b = $request->all();
        $name = array_key_exists('name', $b) ? V::str($b['name'], 'Name', 1, 80) : $u['name'];
        $role = array_key_exists('role', $b) ? V::oneOf($b['role'], 'Role', array_keys(Perms::ROLES)) : $u['role'];
        $status = array_key_exists('status', $b) ? V::oneOf($b['status'], 'Status', self::STATUSES) : $u['status'];
        if ($u['id'] === $me['id'] && ($role !== $u['role'] || $status !== 'active')) throw HttpError::conflict('You cannot change your own role or disable your own account.');
        if ($u['role'] === 'admin' && ($role !== 'admin' || $status !== 'active') && Db::count("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND status = 'active'") <= 1) {
            throw HttpError::conflict('At least one active administrator is required.');
        }
        Db::run('UPDATE users SET name = ?, role = ?, status = ?, fails = 0, locked_until = 0 WHERE id = ?', [$name, $role, $status, $u['id']]);
        if ($status !== 'active') Db::run('DELETE FROM api_sessions WHERE user_id = ?', [$u['id']]);
        if ($role !== $u['role']) Audit::log($me, 'ROLE_ASSIGN', "{$u['email']}: {$u['role']} → $role");
        if ($status !== $u['status']) Audit::log($me, $status === 'active' ? 'USER_ENABLE' : 'USER_DISABLE', "{$u['email']}: {$u['status']} → $status");
        return response()->json(self::userOut(Db::get('SELECT * FROM users WHERE id = ?', [$u['id']])));
    }

    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $u = Db::get('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$u) throw HttpError::notFound('User not found');
        AuthController::checkPassword($request->input('password'));
        Db::run('UPDATE users SET password_hash = ?, fails = 0, locked_until = 0 WHERE id = ?', [Hash::make($request->input('password')), $u['id']]);
        Db::run('DELETE FROM api_sessions WHERE user_id = ?', [$u['id']]);
        Audit::log($request->attributes->get('user'), 'PASSWORD_RESET', $u['email']);
        return response()->json(['ok' => true]);
    }

    public function roles(): JsonResponse
    {
        $grants = [];
        foreach (Db::all('SELECT * FROM role_permissions') as $x) $grants[$x['role']][] = $x['perm'];
        $counts = [];
        foreach (Db::all('SELECT role, COUNT(*) c FROM users GROUP BY role') as $x) $counts[$x['role']] = (int) $x['c'];
        $roles = [];
        foreach (Perms::ROLES as $key => $v) {
            $roles[] = ['key' => $key] + $v + ['users' => $counts[$key] ?? 0, 'permissions' => $grants[$key] ?? [], 'locked' => Perms::LOCKED[$key] ?? []];
        }
        return response()->json(['roles' => $roles, 'permissions' => array_map(fn ($p) => ['key' => $p[0], 'group' => $p[1], 'label' => $p[2]], Perms::catalogue())]);
    }

    public function setRolePermissions(Request $request, string $role): JsonResponse
    {
        $role = V::oneOf($role, 'Role', array_keys(Perms::ROLES));
        $list = $request->input('permissions');
        if (!is_array($list) || array_diff($list, Perms::keys())) throw HttpError::bad('Invalid permission list.');
        $final = array_values(array_unique(array_merge($list, Perms::LOCKED[$role] ?? [])));
        Db::tx(function () use ($role, $final) {
            Db::run('DELETE FROM role_permissions WHERE role = ?', [$role]);
            foreach ($final as $p) Db::run('INSERT INTO role_permissions(role, perm) VALUES (?,?)', [$role, $p]);
        });
        Perms::flush();
        Audit::log($request->attributes->get('user'), 'ROLE_PERMISSIONS', "$role: " . count($final) . ' permissions');
        return response()->json(['role' => $role, 'permissions' => $final]);
    }

    public function logs(Request $request): JsonResponse
    {
        $limit = min(500, (int) $request->query('limit', 200) ?: 200);
        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            $like = "%$q%";
            $rows = Db::all('SELECT * FROM audit_logs WHERE action LIKE ? OR detail LIKE ? OR user_name LIKE ? ORDER BY id DESC LIMIT ' . $limit, [$like, $like, $like]);
        } else $rows = Db::all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ' . $limit);
        return response()->json($rows);
    }

    public function settings(): JsonResponse { return response()->json(Settings::all()); }

    public function updateSettings(Request $request): JsonResponse
    {
        $b = $request->all();
        $cur = Settings::all();
        $next = [];
        foreach (array_keys(Settings::DEFAULTS) as $k) if (array_key_exists($k, $b)) $next[$k] = trim((string) $b[$k]);
        $nums = ['expiry_warning_days' => [1, 365], 'filter_shelf_life_months' => [1, 60], 'session_hours' => [1, 168], 'max_login_attempts' => [3, 20], 'lockout_minutes' => [1, 1440]];
        foreach ($nums as $k => [$lo, $hi]) {
            if (!array_key_exists($k, $next)) continue;
            if (!ctype_digit($next[$k]) || (int) $next[$k] < $lo || (int) $next[$k] > $hi) throw HttpError::bad(str_replace('_', ' ', $k) . " must be a whole number between $lo and $hi.");
        }
        if (array_key_exists('company_name', $next) && $next['company_name'] === '') throw HttpError::bad('Company name is required.');
        if (array_key_exists('allow_self_registration', $next) && !in_array($next['allow_self_registration'], ['true', 'false'], true)) throw HttpError::bad('Invalid value.');
        $changed = [];
        foreach ($next as $k => $v) if ($cur[$k] !== $v) { Settings::set($k, $v); $changed[] = $k; }
        Audit::log($request->attributes->get('user'), 'SETTINGS_UPDATE', $changed ? implode(', ', $changed) : 'no change');
        return response()->json(Settings::all());
    }
}
