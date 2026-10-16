<?php

namespace Tests\Feature;

use App\Mail\ChaseReminderMail;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\UserLogo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
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

    public function test_logo_upload_stores_sniffed_type_and_serves_it(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->post('/api/profile/logo', [
            'logo' => UploadedFile::fake()->createWithContent('my logo.png', base64_decode(self::PNG_1PX)),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('user.has_logo', true);

        $this->assertSame('image/png', UserLogo::find($user->id)->mime);
        $this->asUser($user)->get('/api/profile/logo')
            ->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->asUser($user)->deleteJson('/api/profile/logo')->assertOk()->assertJsonPath('user.has_logo', false);
        $this->asUser($user)->get('/api/profile/logo')->assertNotFound();
    }

    public function test_logo_upload_rejects_disguised_file(): void
    {
        $user = User::factory()->create();
        $fake = UploadedFile::fake()->createWithContent('logo.png', '<?php echo 1;');

        $this->asUser($user)->post('/api/profile/logo', ['logo' => $fake], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->assertNull(UserLogo::find($user->id));
    }

    public function test_logo_is_embedded_in_reminder_email(): void
    {
        $user = User::factory()->create();
        UserLogo::create(['user_id' => $user->id, 'mime' => 'image/png', 'data' => base64_decode(self::PNG_1PX)]);
        $invoice = Invoice::factory()->for(Client::factory()->for($user))->create(['user_id' => $user->id]);

        $html = (new ChaseReminderMail($invoice->load('user', 'client'), 'S', 'Body', null))->render();

        $this->assertMatchesRegularExpression('#<img src="(cid:|data:image/png)#', $html);
    }

    public function test_delete_account_requires_password(): void
    {
        $user = User::factory()->create();

        $this->asUser($user)->deleteJson('/api/profile', ['password' => 'nope'])->assertUnprocessable();
        $this->asUser($user)->deleteJson('/api/profile', ['password' => 'password'])->assertNoContent();
        $this->assertModelMissing($user);
    }
}
