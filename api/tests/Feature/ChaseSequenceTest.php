<?php

namespace Tests\Feature;

use App\Models\ChaseSequence;
use App\Models\User;
use App\Services\DefaultSequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChaseSequenceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        DefaultSequence::createFor($this->user);
    }

    private function step(array $overrides = []): array
    {
        return array_merge([
            'trigger_type' => 'after_due',
            'days_offset' => 3,
            'channel' => 'email',
            'subject' => 'Invoice {invoice_number}',
            'template_body' => 'Hi {client_name}, {amount_due} is due. {payment_link}',
        ], $overrides);
    }

    public function test_list_returns_steps_in_timeline_order(): void
    {
        $res = $this->asUser($this->user)->getJson('/api/chase-sequences')->assertOk();

        $steps = $res->json('data.0.steps');
        $this->assertSame(['before_due', 'after_due', 'after_due'], array_column($steps, 'trigger_type'));
        $this->assertSame([3, 0, 7], array_column($steps, 'days_offset'));
        $this->assertTrue($res->json('data.0.is_default'));
    }

    public function test_create_sequence_with_steps_and_make_default(): void
    {
        $res = $this->asUser($this->user)->postJson('/api/chase-sequences', [
            'name' => 'Firm',
            'is_default' => true,
            'steps' => [$this->step(), $this->step(['channel' => 'sms', 'subject' => null, 'days_offset' => 10, 'template_body' => '{company_name}: {invoice_number} is {days_overdue} days overdue.'])],
        ])->assertCreated()->assertJsonPath('data.is_default', true)->assertJsonCount(2, 'data.steps');

        $this->assertSame(1, ChaseSequence::where('user_id', $this->user->id)->where('is_default', true)->count());
        $this->assertNull($res->json('data.steps.1.subject'));
    }

    public function test_rejects_unknown_placeholders_duplicates_and_missing_subject(): void
    {
        $this->asUser($this->user)->postJson('/api/chase-sequences', [
            'name' => 'Bad',
            'steps' => [
                $this->step(['template_body' => 'Hi {client_nme}']),
                $this->step(),
                $this->step(['days_offset' => 5, 'subject' => '']),
            ],
        ])->assertUnprocessable()->assertJsonValidationErrors(['steps.0.template_body', 'steps.1.days_offset', 'steps.2.subject']);
    }

    public function test_long_sms_rejected(): void
    {
        $this->asUser($this->user)->postJson('/api/chase-sequences', [
            'name' => 'Long',
            'steps' => [$this->step(['channel' => 'sms', 'subject' => null, 'template_body' => str_repeat('a', 460)])],
        ])->assertUnprocessable()->assertJsonValidationErrors('steps.0.template_body');
    }

    public function test_update_preserves_step_ids_and_removes_missing(): void
    {
        $sequence = $this->user->chaseSequences()->first();
        $steps = $sequence->steps()->get();
        $kept = $steps[0];

        $res = $this->asUser($this->user)->putJson("/api/chase-sequences/{$sequence->id}", [
            'name' => 'Renamed',
            'steps' => [
                ['id' => $kept->id] + $this->step(['trigger_type' => 'before_due', 'days_offset' => 5]),
                $this->step(['days_offset' => 14]),
            ],
        ])->assertOk();

        $this->assertSame('Renamed', $res->json('data.name'));
        $this->assertSame($kept->id, $res->json('data.steps.0.id'));
        $this->assertSame(5, $res->json('data.steps.0.days_offset'));
        $this->assertSame(2, $sequence->steps()->count());
    }

    public function test_cannot_reference_foreign_step_or_sequence(): void
    {
        $other = User::factory()->create();
        $foreign = DefaultSequence::createFor($other);
        $mine = $this->user->chaseSequences()->first();

        $this->asUser($this->user)->getJson("/api/chase-sequences/{$foreign->id}")->assertNotFound();
        $this->asUser($this->user)->putJson("/api/chase-sequences/{$mine->id}", [
            'name' => 'Steal',
            'steps' => [['id' => $foreign->steps()->first()->id] + $this->step()],
        ])->assertUnprocessable()->assertJsonValidationErrors('steps.0.id');
    }

    public function test_default_sequence_cannot_be_deleted(): void
    {
        $default = $this->user->chaseSequences()->first();
        $this->asUser($this->user)->deleteJson("/api/chase-sequences/{$default->id}")->assertStatus(409);

        $res = $this->asUser($this->user)->postJson('/api/chase-sequences', ['name' => 'Other', 'steps' => [$this->step()]])->assertCreated();
        $this->asUser($this->user)->postJson('/api/chase-sequences/'.$res->json('data.id').'/default')->assertOk();
        $this->asUser($this->user)->deleteJson("/api/chase-sequences/{$default->id}")->assertNoContent();
    }
}
