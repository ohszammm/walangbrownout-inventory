<?php

namespace App\Http\Middleware;

use App\Support\Db;
use App\Support\HttpError;
use Closure;
use Illuminate\Http\Request;

/**
 * Loads the signed-in user from the HttpOnly `wbi_session` cookie (SHA-256 hashed token in api_sessions)
 * and rejects state-changing requests that are not JSON (a cheap CSRF guard on top of SameSite=Lax).
 */
class ApiAuth
{
    public const COOKIE = 'wbi_session';

    public function handle(Request $request, Closure $next)
    {
        if (!in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)
            && (int) $request->header('content-length', 0) > 0 && !$request->isJson()) {
            throw new HttpError(415, 'JSON body required.');
        }
        $user = null;
        $token = $_COOKIE[self::COOKIE] ?? $request->cookie(self::COOKIE);
        if (is_string($token) && $token !== '') {
            $s = Db::get('SELECT * FROM api_sessions WHERE token_hash = ?', [hash('sha256', $token)]);
            if ($s && $s['expires'] > (int) (microtime(true) * 1000)) {
                $u = Db::get('SELECT id, name, email, role, status FROM users WHERE id = ?', [$s['user_id']]);
                if ($u && $u['status'] === 'active') $user = $u;
            }
        }
        $request->attributes->set('user', $user);
        return $next($request);
    }
}
