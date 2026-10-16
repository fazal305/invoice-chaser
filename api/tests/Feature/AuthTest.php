<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function registerPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ayesha Khan',
            'company_name' => 'Khan Studio',
            'email' => 'Ayesha@Example.com',
            'password' => 'correct-horse-42',
            'password_confirmation' => 'correct-horse-42',
            'timezone' => 'Asia/Karachi',
            'terms' => true,
        ], $overrides);
    }

    public function test_register_returns_token_and_creates_default_sequence(): void
    {
        $res = $this->postJson('/api/auth/register', $this->registerPayload())
            ->assertCreated()
            ->assertJsonPath('user.email', 'ayesha@example.com')
            ->assertJsonPath('user.timezone', 'Asia/Karachi')
            ->assertJsonMissingPath('user.password');

        $user = User::firstWhere('email', 'ayesha@example.com');
        $this->assertSame('bcrypt', password_get_info($user->password)['algoName']);
        $this->assertSame(1, $user->chaseSequences()->where('is_default', true)->count());
        $this->assertSame(3, $user->chaseSequences()->first()->steps()->count());

        $this->withToken($res->json('token'))->getJson('/api/me')
            ->assertOk()->assertJsonPath('user.company_name', 'Khan Studio');
    }

    public function test_register_validates_fields(): void
    {
        $this->postJson('/api/auth/register', $this->registerPayload([
            'password' => 'short', 'password_confirmation' => 'other', 'terms' => false, 'email' => 'nope',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['password', 'terms', 'email']);
    }

    public function test_login_success_and_generic_failure(): void
    {
        User::factory()->create(['email' => 'owner@example.com']);

        $this->postJson('/api/auth/login', ['email' => 'owner@example.com', 'password' => 'password'])
            ->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'email']]);

        $wrong = $this->postJson('/api/auth/login', ['email' => 'owner@example.com', 'password' => 'bad'])
            ->assertUnprocessable()->json('errors.email.0');
        $unknown = $this->postJson('/api/auth/login', ['email' => 'ghost@example.com', 'password' => 'bad'])
            ->assertUnprocessable()->json('errors.email.0');
        $this->assertSame($wrong, $unknown);
    }

    public function test_login_is_rate_limited_per_email(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'x@example.com', 'password' => 'bad'])->assertUnprocessable();
        }
        $this->postJson('/api/auth/login', ['email' => 'x@example.com', 'password' => 'bad'])->assertStatus(429);
    }

    public function test_protected_routes_require_token_and_logout_revokes(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();

        $user = User::factory()->create();
        $token = $user->createToken('spa')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('spa', ['*'], now()->subMinute())->plainTextToken;

        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    public function test_security_headers_present(): void
    {
        $this->getJson('/api/me')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');
    }
}
