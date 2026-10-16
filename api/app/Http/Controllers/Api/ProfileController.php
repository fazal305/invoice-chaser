<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserLogo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    private const LOGO_MIME_TO_EXT = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
    ];

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'company_name' => ['required', 'string', 'max:160'],
            'timezone' => ['required', 'timezone:all'],
            'currency' => ['required', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'payment_terms_days' => ['required', 'integer', 'min:0', 'max:365'],
            'payment_url' => ['nullable', 'url:https', 'max:2048'],
            'payment_instructions' => ['nullable', 'string', 'max:2000'],
            'reply_to_email' => ['nullable', 'email:rfc', 'max:254'],
        ]);

        $user = $request->user();
        $user->fill($data)->save();

        return response()->json(['user' => $user->toProfile()]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'file', 'max:1024', 'mimes:png,jpg,jpeg,webp'],
        ]);

        $file = $request->file('logo');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        $ext = self::LOGO_MIME_TO_EXT[$mime] ?? null;
        if ($ext === null || @getimagesize($file->getRealPath()) === false) {
            throw ValidationException::withMessages(['logo' => 'The logo must be a PNG, JPEG or WebP image.']);
        }

        $user = $request->user();
        UserLogo::updateOrCreate(['user_id' => $user->id], ['mime' => $mime, 'data' => file_get_contents($file->getRealPath())]);

        return response()->json(['user' => $user->toProfile()]);
    }

    public function showLogo(Request $request): Response|JsonResponse
    {
        $logo = UserLogo::find($request->user()->id);
        if (! $logo) {
            return response()->json(['message' => 'No logo uploaded.'], 404);
        }

        return response($logo->data, 200, [
            'Content-Type' => $logo->mime,
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public function deleteLogo(Request $request): JsonResponse
    {
        $user = $request->user();
        UserLogo::whereKey($user->id)->delete();

        return response()->json(['user' => $user->toProfile()]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => 'Password is incorrect.']);
        }

        $user->tokens()->delete();
        $user->invoices()->delete();
        $user->delete();

        return response()->json(null, 204);
    }
}
