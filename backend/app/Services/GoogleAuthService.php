<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class GoogleAuthService
{
    public const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
    public const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
    public const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    /**
     * Check if Google OAuth credentials are fully configured in the environment.
     */
    public function isConfigured(): bool
    {
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');

        return ! empty($clientId) && ! empty($clientSecret);
    }

    /**
     * Build the official Google OAuth authorization URL.
     *
     * @param string|null $state Custom state token (if null, a secure one is generated)
     * @param string|null $redirectUri Custom redirect URI if overriding default
     * @return array{url: string, state: string}
     */
    public function getAuthorizationUrl(?string $state = null, ?string $redirectUri = null): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
        }

        $state = $state ?: Str::random(40);
        // Store state in cache for 15 minutes to prevent CSRF / login CSRF
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        $redirect = $redirectUri ?: config('services.google.redirect_uri');

        $params = [
            'client_id'             => config('services.google.client_id'),
            'redirect_uri'          => $redirect,
            'response_type'         => 'code',
            'scope'                 => 'openid email profile',
            'state'                 => $state,
            'access_type'           => 'offline',
            'prompt'                => 'select_account',
            'include_granted_scopes'=> 'true',
        ];

        return [
            'url'   => self::GOOGLE_AUTH_URL . '?' . http_build_query($params),
            'state' => $state,
        ];
    }

    /**
     * Validate and consume OAuth state to prevent CSRF and replay attacks.
     */
    public function validateState(?string $state): bool
    {
        if (empty($state)) {
            return false;
        }

        // Cache::pull retrieves and immediately deletes the key (atomic single-use)
        return (bool) Cache::pull('google_oauth_state:' . $state);
    }

    /**
     * Exchange Google authorization code for access token.
     *
     * @param string $code Authorization code from Google
     * @param string|null $redirectUri Redirect URI used during auth request
     * @return array Google token response
     */
    public function exchangeCodeForTokens(string $code, ?string $redirectUri = null): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Google OAuth is not configured.');
        }

        $redirect = $redirectUri ?: config('services.google.redirect_uri');

        $response = Http::asForm()->timeout(15)->post(self::GOOGLE_TOKEN_URL, [
            'code'          => $code,
            'client_id'     => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri'  => $redirect,
            'grant_type'    => 'authorization_code',
        ]);

        if (! $response->successful()) {
            Log::warning('Google token exchange failed', [
                'status' => $response->status(),
                'error'  => $response->json('error'),
                'description' => $response->json('error_description'),
            ]);
            throw new RuntimeException($response->json('error_description') ?: 'Failed to exchange authorization code with Google.');
        }

        return $response->json();
    }

    /**
     * Retrieve verified identity details from Google OpenID Connect UserInfo endpoint.
     *
     * @param string $accessToken
     * @return array{sub: string, email: string, name: string, email_verified: bool}
     */
    public function getUserInfoFromGoogle(string $accessToken): array
    {
        $response = Http::withToken($accessToken)
            ->timeout(15)
            ->get(self::GOOGLE_USERINFO_URL);

        if (! $response->successful()) {
            Log::warning('Google userinfo verification failed', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            throw new RuntimeException('Failed to retrieve verified profile from Google.');
        }

        $data = $response->json();

        if (empty($data['sub']) || empty($data['email'])) {
            throw new RuntimeException('Invalid user profile returned from Google.');
        }

        return [
            'sub'            => (string) $data['sub'],
            'email'          => strtolower(trim($data['email'])),
            'name'           => $data['name'] ?? explode('@', $data['email'])[0],
            'email_verified' => filter_var($data['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'picture'        => $data['picture'] ?? null,
        ];
    }

    /**
     * Authenticate or create TicketHub user based on verified Google identity,
     * maintaining role integrity and generating a Sanctum token.
     *
     * @param array{sub: string, email: string, name: string, email_verified: bool} $googleProfile
     * @return array{user: array{id: int, name: string, email: string, role: string}, token: string}
     */
    public function handleGoogleIdentity(array $googleProfile): array
    {
        $googleId = $googleProfile['sub'];
        $email = $googleProfile['email'];
        $name = $googleProfile['name'];

        // 1. Check whether google_id already exists in TicketHub
        $user = User::where('google_id', $googleId)->first();

        if ($user) {
            // Update name or keep up to date if appropriate
            if (empty($user->name) && ! empty($name)) {
                $user->name = $name;
                $user->save();
            }
        } else {
            // 2. Check whether the verified Google email already exists
            $userByEmail = User::where('email', $email)->first();

            if ($userByEmail) {
                // Safely link Google identity to this existing account
                $userByEmail->google_id = $googleId;
                if (empty($userByEmail->name) && ! empty($name)) {
                    $userByEmail->name = $name;
                }
                $userByEmail->save();
                $user = $userByEmail;
            } else {
                // 3. Create new TicketHub customer account (MUST strictly default to customer)
                $user = User::create([
                    'name'       => $name,
                    'email'      => $email,
                    'google_id'  => $googleId,
                    'password'   => null,
                    'role'       => 'customer', // PRIVILEGED ROLES CANNOT BE CREATED VIA GOOGLE OAUTH
                    'created_at' => now(),
                ]);
            }
        }

        // 4. Create standard Laravel Sanctum token for the authenticated user
        $token = $user->createToken('api-token')->plainTextToken;

        return [
            'user' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $user->role,
            ],
            'token' => $token,
        ];
    }
}
