<?php

namespace App\Providers;

use App\Sms\LogSmsSender;
use App\Sms\SmsSender;
use App\Sms\TwilioSmsSender;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SmsSender::class, function () {
            if (config('services.sms.driver') === 'twilio') {
                $c = config('services.twilio');

                return new TwilioSmsSender((string) $c['sid'], (string) $c['token'], (string) $c['from'], $c['status_callback'] ?: null);
            }

            return new LogSmsSender;
        });
    }

    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('auth', fn (Request $request) => [
            Limit::perMinute(20)->by('ip:'.$request->ip()),
            Limit::perMinute(5)->by('email:'.strtolower((string) $request->input('email')).'|'.$request->ip()),
        ]);

        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('webhooks', fn (Request $request) => Limit::perMinute(600)->by($request->ip()));
    }
}
