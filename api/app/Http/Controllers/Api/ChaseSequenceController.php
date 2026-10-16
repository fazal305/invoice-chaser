<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChaseSequence;
use App\Models\ChaseStep;
use App\Services\TemplateRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ChaseSequenceController extends Controller
{
    public const MAX_STEPS = 12;

    public const SMS_MAX = 459;

    public function index(Request $request): JsonResponse
    {
        $sequences = $request->user()->chaseSequences()
            ->with('steps')
            ->withCount('invoices')
            ->orderByDesc('is_default')->orderBy('name')
            ->get();

        return response()->json(['data' => $sequences->map(fn ($s) => $this->present($s))]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $sequence = $this->find($request, $id)->load('steps')->loadCount('invoices');

        return response()->json(['data' => $this->present($sequence)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $sequence = DB::transaction(function () use ($request, $data) {
            $user = $request->user();
            $sequence = $user->chaseSequences()->create([
                'name' => $data['name'],
                'is_default' => ! $user->chaseSequences()->exists(),
            ]);
            $this->syncSteps($sequence, $data['steps']);
            if ($data['is_default'] ?? false) {
                $this->makeDefault($sequence);
            }

            return $sequence;
        });

        return response()->json(['data' => $this->present($sequence->fresh()->load('steps')->loadCount('invoices'))], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $sequence = $this->find($request, $id);
        $data = $this->validated($request, $sequence);

        DB::transaction(function () use ($sequence, $data) {
            $sequence->update(['name' => $data['name']]);
            $this->syncSteps($sequence, $data['steps']);
            if ($data['is_default'] ?? false) {
                $this->makeDefault($sequence);
            }
        });

        return response()->json(['data' => $this->present($sequence->fresh()->load('steps')->loadCount('invoices'))]);
    }

    public function makeDefaultAction(Request $request, int $id): JsonResponse
    {
        $sequence = $this->find($request, $id);
        DB::transaction(fn () => $this->makeDefault($sequence));

        return response()->json(['data' => $this->present($sequence->fresh()->load('steps')->loadCount('invoices'))]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $sequence = $this->find($request, $id);
        if ($sequence->is_default) {
            return response()->json([
                'message' => 'This is your default schedule. Make another schedule the default before deleting it.',
            ], 409);
        }
        $sequence->delete();

        return response()->json(null, 204);
    }

    private function find(Request $request, int $id): ChaseSequence
    {
        return $request->user()->chaseSequences()->findOrFail($id);
    }

    private function makeDefault(ChaseSequence $sequence): void
    {
        ChaseSequence::where('user_id', $sequence->user_id)->where('id', '!=', $sequence->id)->update(['is_default' => false]);
        $sequence->forceFill(['is_default' => true])->save();
    }

    private function syncSteps(ChaseSequence $sequence, array $steps): void
    {
        $keepIds = array_values(array_filter(array_column($steps, 'id')));
        ChaseStep::where('chase_sequence_id', $sequence->id)->whereNotIn('id', $keepIds ?: [0])->delete();

        // Existing step IDs are preserved so reminders already sent for a step are never re-sent.
        foreach ($steps as $step) {
            $attrs = [
                'trigger_type' => $step['days_offset'] === 0 ? 'after_due' : $step['trigger_type'],
                'days_offset' => $step['days_offset'],
                'channel' => $step['channel'],
                'subject' => $step['channel'] === 'email' ? $step['subject'] : null,
                'template_body' => $step['template_body'],
            ];
            if (! empty($step['id'])) {
                ChaseStep::where('chase_sequence_id', $sequence->id)->whereKey($step['id'])->update($attrs + ['updated_at' => now()]);
            } else {
                $sequence->steps()->create($attrs);
            }
        }
    }

    private function validated(Request $request, ?ChaseSequence $sequence = null): array
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100'],
            'is_default' => ['sometimes', 'boolean'],
            'steps' => ['required', 'array', 'min:1', 'max:'.self::MAX_STEPS],
            'steps.*.id' => ['nullable', 'integer'],
            'steps.*.trigger_type' => ['required', Rule::in(ChaseStep::TRIGGERS)],
            'steps.*.days_offset' => ['required', 'integer', 'min:0', 'max:365'],
            'steps.*.channel' => ['required', Rule::in(ChaseStep::CHANNELS)],
            'steps.*.subject' => ['nullable', 'required_if:steps.*.channel,email', 'string', 'max:150'],
            'steps.*.template_body' => ['required', 'string', 'max:2000'],
        ], [
            'steps.required' => 'Add at least one reminder step.',
            'steps.max' => 'A schedule can have at most '.self::MAX_STEPS.' steps.',
            'steps.*.subject.required_if' => 'Email steps need a subject line.',
            'steps.*.template_body.required' => 'Write the reminder message.',
        ]);

        $validator->after(function ($v) use ($request, $sequence) {
            $steps = $request->input('steps');
            if (! is_array($steps)) {
                return;
            }
            $seen = [];
            foreach ($steps as $i => $step) {
                if (! is_array($step)) {
                    continue;
                }
                $channel = $step['channel'] ?? null;
                $offset = is_numeric($step['days_offset'] ?? null) ? (int) $step['days_offset'] : null;
                if ($offset !== null && $channel) {
                    $signed = ($step['trigger_type'] ?? '') === 'before_due' ? -$offset : $offset;
                    if (isset($seen[$signed.'|'.$channel]) && ! $v->errors()->has("steps.$i.days_offset")) {
                        $v->errors()->add("steps.$i.days_offset", "Another $channel step already goes out on this day.");
                    }
                    $seen[$signed.'|'.$channel] = true;
                }

                foreach (['subject', 'template_body'] as $field) {
                    $unknown = is_string($step[$field] ?? null) ? TemplateRenderer::unknownPlaceholders($step[$field]) : [];
                    if ($unknown && ! $v->errors()->has("steps.$i.$field")) {
                        $v->errors()->add("steps.$i.$field", 'Unknown placeholder: {'.implode('}, {', $unknown).'}.');
                    }
                }
                if ($channel === 'sms' && is_string($step['template_body'] ?? null) && mb_strlen($step['template_body']) > self::SMS_MAX) {
                    $v->errors()->add("steps.$i.template_body", 'SMS messages must be '.self::SMS_MAX.' characters or fewer.');
                }
                if (! empty($step['id']) && ! $sequence?->steps()->whereKey($step['id'])->exists()) {
                    $v->errors()->add("steps.$i.id", 'This step no longer exists. Reload and try again.');
                }
            }
        });

        $data = $validator->validate();
        foreach ($data['steps'] as $i => $step) {
            $data['steps'][$i]['days_offset'] = (int) $step['days_offset'];
        }

        return $data;
    }

    private function present(ChaseSequence $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'is_default' => $s->is_default,
            'invoices_count' => $s->invoices_count ?? 0,
            'steps' => $s->steps->map(fn (ChaseStep $st) => [
                'id' => $st->id,
                'trigger_type' => $st->trigger_type,
                'days_offset' => $st->days_offset,
                'channel' => $st->channel,
                'subject' => $st->subject,
                'template_body' => $st->template_body,
            ])->values(),
            'updated_at' => $s->updated_at?->toIso8601String(),
        ];
    }
}
