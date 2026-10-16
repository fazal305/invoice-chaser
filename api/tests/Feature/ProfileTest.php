<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    private const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    private function validProfile(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Owner',
            'company_name' => 'Acme Ltd',
            'timezone' => 'Europe/London',
            'currency' => 'GBP',
            'payment_terms_days' => 14,
            'payment_url' => 'https://pay.example.com/acme',
            'payment_instructions' => "Bank: Example Bank\nIBAN: GB00 0000",
            'reply_to_email' => 'accounts@acme.test',
        ], $overrides);
    }

    public function test_update_profile(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->putJson('/api/profile', $this->validProfile())
            ->assertOk()->assertJsonPath('user.currency', 'GBP')->assertJsonPath('user.payment_terms_days', 14);
    }

    public function test_update_profile_rejects_bad_values(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->putJson('/api/profile', $this->validProfile([
            'timezone' => 'Mars/Base', 'currency' => 'usd', 'payment_url' => 'javascript:alert(1)',
        ]))->assertUnprocessable()->assertJsonValidationErrors(['timezone', 'currency', 'payment_url']);
    }

    public function test_logo_upload_sniffs_content_and_randomizes_name(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $this->asUser($user)->post('/api/profile/logo', [
            'logo' => UploadedFile::fake()->createWithContent('my logo.png', base64_decode(self::PNG_1PX)),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('user.has_logo', true);

        $path = $user->fresh()->logo_path;
        $this->assertMatchesRegularExpression('#^logos/[A-Za-z0-9]{40}\.png$#', $path);
        Storage::disk('local')->assertExists($path);

        $this->asUser($user)->get('/api/profile/logo')->assertOk();
    }

    public function test_logo_upload_rejects_disguised_file(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $fake = UploadedFile::fake()->createWithContent('logo.png', '<?php echo 1;');

        $this->asUser($user)->post('/api/profile/logo', ['logo' => $fake], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->assertNull($user->fresh()->logo_path);
    }

    public function test_delete_account_requires_password(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->deleteJson('/api/profile', ['password' => 'nope'])->assertUnprocessable();
        $this->asUser($user)->deleteJson('/api/profile', ['password' => 'password'])->assertNoContent();
        $this->assertModelMissing($user);
    }
}
