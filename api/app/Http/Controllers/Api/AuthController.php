<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DefaultSequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Compared against when the email is unknown so a miss costs the same as a wrong password.
    private const DUMMY_HASH = '$2y$12$2n.gk5l2P70qadIsipqu.eTX11YPL/Wy0gsyzCMkjgYzBT1mH/zlG';

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'company_name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(10)->letters()->numbers()],
            'timezone' => ['nullable', 'timezone:all'],
            'terms' => ['accepted'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'company_name' => $data['company_name'],
                'email' => strtolower($data['email']),
                'password' => $data['password'],
                'timezone' => $data['timezone'] ?? 'UTC',
            ]);
            DefaultSequence::createFor($user);

            return $user;
        });

        return response()->json([
            'token' => $this->issueToken($user),
            'user' => $user->toProfile(),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        $user = User::where('email', strtolower($data['email']))->first();
        $valid = Hash::check($data['password'], $user?->password ?? self::DUMMY_HASH);

        if (! $user || ! $valid) {
            throw ValidationException::withMessages([
                'email' => 'That email and password combination is not correct.',
            ]);
        }

        return response()->json([
            'token' => $this->issueToken($user),
            'user' => $user->toProfile(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->toProfile()]);
    }

    private function issueToken(User $user): string
    {
        return $user->createToken('spa', ['*'], now()->addMinutes((int) config('sanctum.expiration')))->plainTextToken;
    }
}
