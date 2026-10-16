<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
        $path = $file->storeAs('logos', Str::random(40).'.'.$ext, 'local');
        $old = $user->logo_path;
        $user->forceFill(['logo_path' => $path])->save();
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return response()->json(['user' => $user->toProfile()]);
    }

    public function showLogo(Request $request): StreamedResponse|JsonResponse
    {
        $path = $request->user()->logo_path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'No logo uploaded.'], 404);
        }

        return Storage::disk('local')->response($path, null, [
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public function deleteLogo(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->logo_path) {
            Storage::disk('local')->delete($user->logo_path);
            $user->forceFill(['logo_path' => null])->save();
        }

        return response()->json(['user' => $user->toProfile()]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();

        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['password' => 'Password is incorrect.']);
        }

        if ($user->logo_path) {
            Storage::disk('local')->delete($user->logo_path);
        }
        $user->tokens()->delete();
        $user->invoices()->delete();
        $user->delete();

        return response()->json(null, 204);
    }
}
