<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChaseSequenceController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:auth')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::put('/profile', [ProfileController::class, 'update']);
    Route::delete('/profile', [ProfileController::class, 'destroy']);
    Route::get('/profile/logo', [ProfileController::class, 'showLogo']);
    Route::post('/profile/logo', [ProfileController::class, 'uploadLogo'])->middleware('throttle:uploads');
    Route::delete('/profile/logo', [ProfileController::class, 'deleteLogo']);

    Route::apiResource('clients', ClientController::class)->whereNumber('client');
    Route::apiResource('invoices', InvoiceController::class)->whereNumber('invoice');
    Route::post('/invoices/{invoice}/status', [InvoiceController::class, 'updateStatus'])->whereNumber('invoice');

    Route::apiResource('chase-sequences', ChaseSequenceController::class)
        ->parameters(['chase-sequences' => 'sequence'])->whereNumber('sequence');
    Route::post('/chase-sequences/{sequence}/default', [ChaseSequenceController::class, 'makeDefaultAction'])->whereNumber('sequence');

    Route::get('/dashboard', DashboardController::class);
    Route::post('/import/{type}', ImportController::class)->whereIn('type', ['clients', 'invoices'])->middleware('throttle:uploads');
    Route::get('/notifications',[NotificationController::class, 'index']);
    Route::post('/notifications/read', [NotificationController::class, 'markAllRead']);
});

Route::middleware('throttle:webhooks')->prefix('webhooks')->group(function () {
    Route::post('/mailgun', [WebhookController::class, 'mailgun']);
    Route::post('/twilio/status', [WebhookController::class, 'twilioStatus']);
    Route::post('/twilio/inbound', [WebhookController::class, 'twilioInbound']);
});
