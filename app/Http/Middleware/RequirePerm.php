<?php

namespace App\Http\Middleware;

use App\Services\Perms;
use App\Support\HttpError;
use Closure;
use Illuminate\Http\Request;

/** Usage: ->middleware('perm:a.b') or 'perm:a.b,c.d' (any of). */
class RequirePerm
{
    public function handle(Request $request, Closure $next, string ...$perms)
    {
        $user = $request->attributes->get('user');
        if (!$user) throw new HttpError(401, 'Please sign in.');
        foreach ($perms as $p) if (Perms::roleHas($user['role'], $p)) return $next($request);
        throw HttpError::forbidden();
    }
}
