<?php

namespace App\Http\Controllers;

use App\Services\GoogleAuthService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GoogleAuthController extends Controller
{
    protected GoogleAuthService $googleAuthService;

    public function __construct(GoogleAuthService $googleAuthService)
    {
        $this->googleAuthService = $googleAuthService;
    }

    /**
     * Return Google OAuth authorization URL or configuration status.
     *
     * GET /api/auth/google/url
     */
    public function getUrl(Request $request): JsonResponse
    {
        if (! $this->googleAuthService->isConfigured()) {
            return response()->json([
                'configured' => false,
                'message'    => 'Google OAuth is not configured on this server. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
            ], 503);
        }

        try {
            $redirectUri = $request->query('redirect_uri');
            $authData = $this->googleAuthService->getAuthorizationUrl(null, $redirectUri);

            return response()->json([
                'configured' => true,
                'url'        => $authData['url'],
                'state'      => $authData['state'],
            ], 200);
        } catch (Exception $e) {
            return response()->json([
                'configured' => false,
                'message'    => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Redirect directly to Google OAuth authorization page.
     *
     * GET /api/auth/google/redirect
     */
    public function redirect(Request $request): RedirectResponse
    {
        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));

        if (! $this->googleAuthService->isConfigured()) {
            return redirect($frontendUrl . '/login?oauth_error=' . urlencode('Google OAuth is not configured on the server.'));
        }

        try {
            $redirectUri = $request->query('redirect_uri');
            $authData = $this->googleAuthService->getAuthorizationUrl(null, $redirectUri);

            return redirect()->away($authData['url']);
        } catch (Exception $e) {
            return redirect($frontendUrl . '/login?oauth_error=' . urlencode($e->getMessage()));
        }
    }

    /**
     * Handle the OAuth redirect callback from Google (GET).
     *
     * GET /api/auth/google/callback
     */
    public function callback(Request $request): RedirectResponse
    {
        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));

        // 1. Handle error response from Google (e.g. user denied consent)
        if ($request->has('error')) {
            $errorDesc = $request->query('error_description') ?: $request->query('error');
            Log::info('Google OAuth authorization was denied or cancelled', ['error' => $errorDesc]);

            return redirect($frontendUrl . '/login?oauth_error=' . urlencode('Google authorization was cancelled or denied.'));
        }

        // 2. Validate OAuth state parameter
        $state = $request->query('state');
        if (! $state || ! $this->googleAuthService->validateState($state)) {
            return redirect($frontendUrl . '/login?oauth_error=' . urlencode('Invalid or expired OAuth security state. Please try again.'));
        }

        // 3. Validate presence of authorization code
        $code = $request->query('code');
        if (! $code) {
            return redirect($frontendUrl . '/login?oauth_error=' . urlencode('Missing authorization code from Google.'));
        }

        try {
            // 4. Exchange code for tokens with Google
            $tokens = $this->googleAuthService->exchangeCodeForTokens($code);

            // 5. Fetch verified profile from Google OpenID Connect
            $profile = $this->googleAuthService->getUserInfoFromGoogle($tokens['access_token']);

            // 6. Authenticate, link, or register user (strictly customer default) and generate Sanctum token
            $authResult = $this->googleAuthService->handleGoogleIdentity($profile);

            // 7. Redirect back to frontend with token and safe user payload
            $tokenParam = urlencode($authResult['token']);
            $userParam = urlencode(json_encode($authResult['user']));

            return redirect($frontendUrl . '/login?auth_token=' . $tokenParam . '&auth_user=' . $userParam);
        } catch (Exception $e) {
            Log::error('Google OAuth callback error', ['exception' => $e->getMessage()]);

            return redirect($frontendUrl . '/login?oauth_error=' . urlencode($e->getMessage()));
        }
    }

    /**
     * Handle JSON API code exchange callback (POST).
     *
     * POST /api/auth/google/callback
     */
    public function exchange(Request $request): JsonResponse
    {
        if (! $this->googleAuthService->isConfigured()) {
            return response()->json([
                'message' => 'Google OAuth is not configured on this server.',
            ], 503);
        }

        $validated = $request->validate([
            'code'         => ['required', 'string'],
            'state'        => ['nullable', 'string'],
            'redirect_uri' => ['nullable', 'string'],
        ]);

        // Validate state if provided
        if (! empty($validated['state']) && ! $this->googleAuthService->validateState($validated['state'])) {
            return response()->json([
                'message' => 'Invalid or expired OAuth security state. Please try again.',
            ], 422);
        }

        try {
            $redirectUri = $validated['redirect_uri'] ?? null;
            $tokens = $this->googleAuthService->exchangeCodeForTokens($validated['code'], $redirectUri);
            $profile = $this->googleAuthService->getUserInfoFromGoogle($tokens['access_token']);
            $authResult = $this->googleAuthService->handleGoogleIdentity($profile);

            return response()->json([
                'message' => 'Google authentication successful.',
                'user'    => $authResult['user'],
                'token'   => $authResult['token'],
            ], 200);
        } catch (Exception $e) {
            Log::error('Google OAuth exchange failed', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => $e->getMessage() ?: 'Failed to authenticate with Google.',
            ], 400);
        }
    }
}
