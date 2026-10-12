<?php

use Illuminate\Support\Facades\Route;

// Serves the built React app (npm run build -> public/spa). Any non-API URL falls through to it so deep links work.
Route::get('/{any?}', function () {
    $index = public_path('spa/index.html');
    if (!is_file($index)) {
        return response('<!doctype html><meta charset="utf-8"><title>WalangBrownout</title><body style="font-family:sans-serif;max-width:560px;margin:60px auto"><h2>Frontend not built yet</h2><p>Run <code>npm install</code> and <code>npm run build</code>, then refresh. For development run <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a>.</p></body>', 200);
    }
    return response()->file($index);
})->where('any', '^(?!api(/|$)).*$');
