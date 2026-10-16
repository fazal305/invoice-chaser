<?php

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);
        // Only the platform's private-network proxy is trusted, so clients can't spoof their IP past rate limits.
        $middleware->trustProxies(at: ['10.0.0.0/8', '100.64.0.0/10', '172.16.0.0/12', '192.168.0.0/16', 'fd00::/8']);
        $middleware->redirectGuestsTo(fn () => null);
        // Provider signatures cover the raw values, so webhook input must not be normalised.
        $isWebhook = fn (Request $request) => $request->is('api/webhooks/*');
        $middleware->trimStrings(except: [$isWebhook]);
        $middleware->convertEmptyStringsToNull(except: [$isWebhook]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
