<?php

use App\Http\Middleware\ApiAuth;
use App\Http\Middleware\RequireLogin;
use App\Http\Middleware\RequirePerm;
use App\Support\HttpError;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [ApiAuth::class]);
        $middleware->alias(['perm' => RequirePerm::class, 'login' => RequireLogin::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*'));
        $exceptions->render(function (HttpError $e, Request $r) {
            return response()->json(array_merge(['error' => $e->getMessage()], $e->extra), $e->status);
        });
        $exceptions->render(function (NotFoundHttpException $e, Request $r) {
            if ($r->is('api/*')) return response()->json(['error' => 'Unknown API route.'], 404);
        });
        $exceptions->render(function (HttpExceptionInterface $e, Request $r) {
            if ($r->is('api/*')) return response()->json(['error' => $e->getMessage() ?: 'Request failed.'], $e->getStatusCode());
        });
        $exceptions->render(function (Throwable $e, Request $r) {
            if ($r->is('api/*')) {
                report($e);
                return response()->json(['error' => config('app.debug') ? $e->getMessage() : 'Something went wrong on the server.'], 500);
            }
        });
    })->create();
