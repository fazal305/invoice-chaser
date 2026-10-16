<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

/**
 * Lets an external scheduler run the hourly chase on hosts that sleep when idle.
 * Disabled unless CRON_SECRET is set.
 */
class CronController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('services.cron.secret');
        if ($secret === '' || ! hash_equals($secret, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $lock = Cache::lock('cron:chase-run', 300);
        if (! $lock->get()) {
            return response()->json(['message' => 'A run is already in progress.'], 409);
        }

        try {
            set_time_limit(120);
            Artisan::call('chase:run');
            $summary = trim(Artisan::output());
            Artisan::call('queue:work', ['--stop-when-empty' => true, '--max-time' => 90, '--tries' => 4]);
        } finally {
            $lock->release();
        }

        return response()->json(['message' => 'OK', 'chase' => $summary]);
    }
}
