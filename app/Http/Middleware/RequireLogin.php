<?php

namespace App\Http\Middleware;

use App\Support\HttpError;
use Closure;
use Illuminate\Http\Request;

class RequireLogin
{
    public function handle(Request $request, Closure $next)
    {
        if (!$request->attributes->get('user')) throw new HttpError(401, 'Please sign in.');
        return $next($request);
    }
}
