<?php

namespace App\Http\Controllers;

use App\Http\Middleware\ApiAuth;
use App\Services\Audit;
use App\Services\Perms;
use App\Services\Settings;
use App\Support\Db;
use App\Support\HttpError;
use App\Support\V;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public static function publicUser(array $u): array
    {
        return ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'photo' => self::photoUrl((int) $u['id']), 'permissions' => Perms::of($u['role'])];
    }

    /** Where a user's profile photo is stored (one JPEG per user, outside the public folder). */
    private static function photoPath(int $id): string
    {
        return storage_path("app/avatars/{$id}.jpg");
    }

    /** URL of the user's profile photo, or null if they have none. The ?v= part refreshes the browser cache after a change. */
    public static function photoUrl(int $id): ?string
    {
        $f = self::photoPath($id);
        return is_file($f) ? "/api/auth/photo/{$id}?v=" . filemtime($f) : null;
    }

    public static function checkPassword($pw): void
    {
        if (!is_string($pw) || mb_strlen($pw) < 8) throw HttpError::bad('Password must be at least 8 characters.');
        if (mb_strlen($pw) > 100) throw HttpError::bad('Password is too long.');
    }

    private function sessionCookie(string $token, int $minutes)
    {
        return cookie(ApiAuth::COOKIE, $token, $minutes, '/', null, filter_var(env('COOKIE_SECURE', false), FILTER_VALIDATE_BOOL), true, false, 'lax');
    }

    public function health(): JsonResponse
    {
        Db::get('SELECT 1');
        return response()->json(['ok' => true, 'database' => 'connected', 'backend' => 'online']);
    }

    public function login(Request $request): JsonResponse
    {
        $email = trim((string) $request->input('email', ''));
        $password = (string) $request->input('password', '');
        $u = Db::get('SELECT * FROM users WHERE lower(email) = lower(?)', [$email]);
        $generic = new HttpError(401, 'Incorrect email or password.');
        if (!$u) { Hash::check('x', Hash::make('y')); throw $generic; }
        $nowMs = (int) (microtime(true) * 1000);
        if ($u['locked_until'] > $nowMs) throw new HttpError(429, 'Too many failed attempts. Try again in ' . (int) ceil(($u['locked_until'] - $nowMs) / 60000) . ' minute(s).');
        if (!Hash::check($password, $u['password_hash'])) {
            $fails = $u['fails'] + 1;
            if ($fails >= Settings::num('max_login_attempts')) {
                Db::run('UPDATE users SET fails = 0, locked_until = ? WHERE id = ?', [$nowMs + Settings::num('lockout_minutes') * 60000, $u['id']]);
                Audit::log($u, 'LOGIN_LOCKED', "{$u['email']} locked after $fails failed attempts");
            } else Db::run('UPDATE users SET fails = ? WHERE id = ?', [$fails, $u['id']]);
            throw $generic;
        }
        if ($u['status'] === 'pending') throw new HttpError(403, 'Your account is waiting for administrator approval.');
        if ($u['status'] !== 'active') throw new HttpError(403, 'This account has been disabled. Contact your administrator.');
        Db::run('UPDATE users SET fails = 0, locked_until = 0, last_login = ? WHERE id = ?', [gmdate('c'), $u['id']]);

        $token = bin2hex(random_bytes(32));
        $hours = Settings::num('session_hours');
        Db::run('INSERT INTO api_sessions(token_hash, user_id, expires) VALUES (?,?,?)', [hash('sha256', $token), $u['id'], $nowMs + $hours * 3600 * 1000]);
        Audit::log($u, 'LOGIN', $u['email']);
        return response()->json(['user' => self::publicUser($u)])->withCookie($this->sessionCookie($token, $hours * 60));
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        if ($user) Audit::log($user, 'LOGOUT', $user['email']);
        $token = $request->cookie(ApiAuth::COOKIE) ?? ($_COOKIE[ApiAuth::COOKIE] ?? null);
        if ($token) Db::run('DELETE FROM api_sessions WHERE token_hash = ?', [hash('sha256', $token)]);
        return response()->json(['ok' => true])->withCookie(cookie()->forget(ApiAuth::COOKIE));
    }

    public function me(Request $request): JsonResponse
    {
        $u = $request->attributes->get('user');
        return response()->json(['user' => $u ? self::publicUser($u) : null]);
    }

    public function register(Request $request): JsonResponse
    {
        if (Settings::all()['allow_self_registration'] !== 'true') throw HttpError::bad('Self-registration is disabled.');
        $name = V::str($request->input('name'), 'Name', 1, 80);
        $email = strtolower(V::str($request->input('email'), 'Email', 1, 120));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw HttpError::bad('Enter a valid email address.');
        self::checkPassword($request->input('password'));
        if (Db::get('SELECT 1 x FROM users WHERE lower(email) = ?', [$email])) throw HttpError::conflict('An account with that email already exists.');
        Db::run('INSERT INTO users(name, email, password_hash, role, status, created_at) VALUES (?,?,?,?,?,?)', [$name, $email, Hash::make($request->input('password')), 'sales', 'pending', gmdate('c')]);
        Audit::log(['name' => $name], 'REGISTER', "$email requested access (pending approval)");
        return response()->json(['ok' => true, 'message' => 'Account request sent. An administrator must approve it before you can sign in.'], 201);
    }

    public function updateAccount(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $name = V::str($request->input('name'), 'Name', 1, 80);
        Db::run('UPDATE users SET name = ? WHERE id = ?', [$name, $user['id']]);
        Audit::log($user, 'ACCOUNT_UPDATE', 'Updated own profile');
        return response()->json(['user' => self::publicUser(['name' => $name] + $user)]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $u = Db::get('SELECT * FROM users WHERE id = ?', [$user['id']]);
        if (!Hash::check((string) $request->input('current', ''), $u['password_hash'])) throw HttpError::bad('Current password is incorrect.');
        self::checkPassword($request->input('next'));
        Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [Hash::make($request->input('next')), $u['id']]);
        Audit::log($user, 'PASSWORD_CHANGE', 'Changed own password');
        return response()->json(['ok' => true]);
    }

    /**
     * Saves the signed-in user's profile photo. The browser crops it to a square and sends a small JPEG
     * as a data URL; the server checks it really is a JPEG image and stores it as {user id}.jpg.
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $data = (string) $request->input('image', '');
        $prefix = 'data:image/jpeg;base64,';
        if (strncmp($data, $prefix, strlen($prefix)) !== 0) throw HttpError::bad('Upload a JPEG or PNG image.');
        $bin = base64_decode(substr($data, strlen($prefix)), true);
        if ($bin === false || $bin === '') throw HttpError::bad('That image could not be read.');
        if (strlen($bin) > 600 * 1024) throw HttpError::bad('That image is too large (max 600 KB after resizing).');
        $info = @getimagesizefromstring($bin);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) throw HttpError::bad('That file is not a valid image.');
        $dir = dirname(self::photoPath((int) $user['id']));
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        file_put_contents(self::photoPath((int) $user['id']), $bin);
        Audit::log($user, 'PHOTO_UPDATE', 'Updated own profile photo');
        return response()->json(['user' => self::publicUser($user)]);
    }

    /** Removes the signed-in user's profile photo (the avatar goes back to their initials). */
    public function deletePhoto(Request $request): JsonResponse
    {
        $user = $request->attributes->get('user');
        $f = self::photoPath((int) $user['id']);
        if (is_file($f)) unlink($f);
        Audit::log($user, 'PHOTO_REMOVE', 'Removed own profile photo');
        return response()->json(['user' => self::publicUser($user)]);
    }

    /** Streams a user's profile photo. Only signed-in users can see photos. */
    public function showPhoto(int $id)
    {
        $f = self::photoPath($id);
        if (!is_file($f)) throw HttpError::notFound('No photo.');
        return response()->file($f, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, max-age=86400']);
    }
}
