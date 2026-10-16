<?php

namespace App\Http\Controllers\Api;

use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public const PHONE_REGEX = '/^\+[1-9]\d{6,14}$/';

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'all' => ['nullable', 'boolean'],
        ]);

        $query = $request->user()->clients()
            ->withCount('invoices')
            ->withCount(['invoices as open_invoices_count' => fn ($q) => $q->whereIn('status', [InvoiceStatus::Sent, InvoiceStatus::Overdue])])
            ->orderBy('name');

        if ($term = trim((string) $request->input('q'))) {
            $like = '%'.addcslashes($term, '%_\\').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like));
        }

        if ($request->boolean('all')) {
            return ClientResource::collection($query->limit(1000)->get());
        }

        return ClientResource::collection($query->paginate(25)->withQueryString());
    }

    public function store(Request $request): JsonResponse
    {
        $client = $request->user()->clients()->create($this->validated($request));

        return (new ClientResource($client))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $id): ClientResource
    {
        return new ClientResource($this->find($request, $id)->loadCount('invoices'));
    }

    public function update(Request $request, int $id): ClientResource
    {
        $client = $this->find($request, $id);
        $client->update($this->validated($request, $client));

        return new ClientResource($client);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $client = $this->find($request, $id);
        if ($client->invoices()->exists()) {
            return response()->json([
                'message' => 'This client still has invoices. Delete or reassign them first.',
            ], 409);
        }
        $client->delete();

        return response()->json(null, 204);
    }

    private function find(Request $request, int $id): Client
    {
        return $request->user()->clients()->findOrFail($id);
    }

    private function validated(Request $request, ?Client $client = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => [
                'nullable', 'required_without:phone', 'email:rfc', 'max:254',
                Rule::unique('clients', 'email')->where('user_id', $request->user()->id)->ignore($client?->id),
            ],
            'phone' => ['nullable', 'required_without:email', 'string', 'regex:'.self::PHONE_REGEX],
            'sms_opt_out' => ['sometimes', 'boolean'],
        ], [
            'phone.regex' => 'Use international format, e.g. +923001234567.',
            'email.required_without' => 'Add an email or a phone number.',
            'phone.required_without' => 'Add an email or a phone number.',
            'email.unique' => 'You already have a client with this email.',
        ]);

        if (isset($data['email'])) {
            $data['email'] = strtolower($data['email']);
        }

        return $data;
    }
}
