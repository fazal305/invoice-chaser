<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name', 'email', 'password', 'company_name', 'timezone', 'currency',
    'payment_terms_days', 'payment_url', 'payment_instructions', 'reply_to_email',
])]
#[Hidden(['password', 'logo_path'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'payment_terms_days' => 'integer',
        ];
    }

    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function chaseSequences(): HasMany
    {
        return $this->hasMany(ChaseSequence::class);
    }

    public function toProfile(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'company_name' => $this->company_name,
            'has_logo' => $this->logo_path !== null,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'payment_terms_days' => $this->payment_terms_days,
            'payment_url' => $this->payment_url,
            'payment_instructions' => $this->payment_instructions,
            'reply_to_email' => $this->reply_to_email,
            'email_delivery_enabled' => ! in_array(config('mail.default'), ['log', 'array'], true),
            'sms_delivery_enabled' => config('services.sms.driver') === 'twilio',
        ];
    }

    /** The user's current calendar date, as midnight UTC so it compares cleanly with stored DATE columns. */
    public function localToday(): CarbonImmutable
    {
        return CarbonImmutable::parse(now($this->timezone)->toDateString(), 'UTC');
    }
}
