<?php

namespace App\Http\Controllers\Api;

use App\Enums\ChaseLogStatus;
use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\ChasePlanner;
use App\Services\InvoiceStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class InvoiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', new Enum(InvoiceStatus::class)],
            'client_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['due_date', '-due_date', 'amount', '-amount', '-created_at'])],
        ]);

        $user = $request->user();
        InvoiceStatusService::sweepOverdue($user);

        $query = $user->invoices()->with('client')
            ->withCount(['chaseLogs as reminders_sent' => fn ($q) => $q->whereIn('status', [
                ChaseLogStatus::Sent, ChaseLogStatus::Delivered, ChaseLogStatus::Opened,
            ])]);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($clientId = $request->input('client_id')) {
            $query->where('client_id', $clientId);
        }
        if ($term = trim((string) $request->input('q'))) {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(fn ($q) => $q->where('invoice_number', 'like', $like)
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $like)));
        }

        $sort = $request->input('sort', 'due_date');
        $query->orderBy(ltrim($sort, '-'), str_starts_with($sort, '-') ? 'desc' : 'asc')->orderBy('id');

        return InvoiceResource::collection($query->paginate(25)->withQueryString());
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->validated($request);
        $data['status'] = InvoiceStatusService::derive(
            InvoiceStatus::from($data['status'] ?? 'draft'), $data['due_date'], $user,
        );
        if ($data['status'] === InvoiceStatus::Paid) {
            $data['paid_at'] = now();
        }

        $invoice = $user->invoices()->create($data);

        return (new InvoiceResource($invoice->load('client', 'chaseSequence')))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        InvoiceStatusService::sweepOverdue($request->user());
        $invoice = $this->find($request, $id)->load('client', 'chaseSequence');

        $logs = $invoice->chaseLogs()->with('step:id,trigger_type,days_offset')
            ->orderByDesc('scheduled_for')->orderByDesc('id')->get()
            ->map(fn ($log) => [
                'id' => $log->id,
                'channel' => $log->channel,
                'recipient' => $log->recipient,
                'status' => $log->status->value,
                'attempts' => $log->attempts,
                'scheduled_for' => $log->scheduled_for->toDateString(),
                'sent_at' => $log->sent_at?->toIso8601String(),
                'delivered_at' => $log->delivered_at?->toIso8601String(),
                'opened_at' => $log->opened_at?->toIso8601String(),
                'error_message' => $log->error_message,
                'step' => $log->step ? [
                    'trigger_type' => $log->step->trigger_type,
                    'days_offset' => $log->step->days_offset,
                ] : null,
                'created_at' => $log->created_at->toIso8601String(),
            ]);

        return response()->json([
            'data' => new InvoiceResource($invoice),
            'activity' => $logs,
            'upcoming' => $this->upcoming($request, $invoice),
        ]);
    }

    private function upcoming(Request $request, Invoice $invoice): array
    {
        if (! $invoice->status->isChaseable()) {
            return [];
        }
        $user = $request->user();
        $sequence = $invoice->chaseSequence
            ?? $user->chaseSequences()->where('is_default', true)->first();
        if (! $sequence) {
            return [];
        }

        $logged = $invoice->chaseLogs()->whereNotNull('chase_step_id')->pluck('chase_step_id')->flip()->map(fn () => true)->all();
        $plan = ChasePlanner::plan($invoice, $sequence->steps()->get(), $logged, $user->localToday());

        $row = fn ($r, $state) => [
            'date' => $r[1]->toDateString(),
            'channel' => $r[0]->channel,
            'trigger_type' => $r[0]->trigger_type,
            'days_offset' => $r[0]->days_offset,
            'state' => $state,
        ];

        return array_merge(
            array_map(fn ($r) => $row($r, 'due_now'), $plan['send']),
            array_map(fn ($r) => $row($r, 'scheduled'), $plan['upcoming']),
        );
    }

    public function update(Request $request, int $id): InvoiceResource
    {
        $invoice = $this->find($request, $id);
        if (in_array($invoice->status, [InvoiceStatus::Paid, InvoiceStatus::Cancelled], true)) {
            abort(response()->json(['message' => 'Paid or cancelled invoices can\'t be edited. Reopen it first.'], 409));
        }

        $data = $this->validated($request, $invoice);
        unset($data['status']);

        DB::transaction(function () use ($invoice, $data, $request) {
            $invoice->fill($data);
            if ($invoice->status->isChaseable()) {
                $invoice->status = InvoiceStatusService::derive(InvoiceStatus::Sent, $invoice->due_date->toDateString(), $request->user());
            }
            $invoice->save();
        });

        return new InvoiceResource($invoice->load('client', 'chaseSequence'));
    }

    public function updateStatus(Request $request, int $id): InvoiceResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['draft', 'sent', 'paid', 'cancelled'])],
        ]);
        $invoice = InvoiceStatusService::transition($this->find($request, $id), InvoiceStatus::from($data['status']));

        return new InvoiceResource($invoice->load('client', 'chaseSequence'));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->find($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function find(Request $request, int $id): Invoice
    {
        return $request->user()->invoices()->findOrFail($id);
    }

    private function validated(Request $request, ?Invoice $invoice = null): array
    {
        $userId = $request->user()->id;

        $data = $request->validate([
            'client_id' => ['required', 'integer', Rule::exists('clients', 'id')->where('user_id', $userId)],
            'chase_sequence_id' => ['nullable', 'integer', Rule::exists('chase_sequences', 'id')->where('user_id', $userId)],
            'invoice_number' => [
                'required', 'string', 'max:64', 'regex:/^[\w\-\/.#]+$/u',
                Rule::unique('invoices', 'invoice_number')->where('user_id', $userId)->ignore($invoice?->id),
            ],
            'amount' => ['required', 'decimal:0,2', 'gt:0', 'max:9999999999.99'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'status' => [$invoice ? 'prohibited' : 'nullable', Rule::in(['draft', 'sent', 'paid'])],
            'issue_date' => ['required', 'date_format:Y-m-d'],
            'due_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:issue_date'],
            'payment_url' => ['nullable', 'url:https', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'invoice_number.unique' => 'You already have an invoice with this number.',
            'invoice_number.regex' => 'Use letters, numbers, and - / . # only.',
            'client_id.exists' => 'Choose one of your clients.',
            'chase_sequence_id.exists' => 'Choose one of your chase schedules.',
            'due_date.after_or_equal' => 'The due date can\'t be before the issue date.',
            'amount.decimal' => 'Use at most two decimal places.',
        ]);

        return $data;
    }
}
