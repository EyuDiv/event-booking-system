<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\GoogleAuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Default mock config for testing
        Config::set('services.google.client_id', 'mock-google-client-id.apps.googleusercontent.com');
        Config::set('services.google.client_secret', 'mock-google-client-secret');
        Config::set('services.google.redirect_uri', 'http://localhost:8000/api/auth/google/callback');
    }

    /**
     * 1. Check unconfigured credentials returns clear error status (503).
     */
    public function test_get_url_returns_503_when_credentials_unconfigured(): void
    {
        Config::set('services.google.client_id', null);
        Config::set('services.google.client_secret', null);

        $response = $this->getJson('/api/auth/google/url');

        $response->assertStatus(503);
        $response->assertJson([
            'configured' => false,
        ]);
        $this->assertStringContainsString('not configured', $response->json('message'));
    }

    /**
     * 2. Check get-url generates valid authorization URL and caches state token.
     */
    public function test_get_url_returns_valid_authorization_url_and_stores_state(): void
    {
        $response = $this->getJson('/api/auth/google/url');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'configured',
            'url',
            'state',
        ]);

        $state = $response->json('state');
        $this->assertNotEmpty($state);
        $this->assertTrue(Cache::has('google_oauth_state:' . $state));

        $url = $response->json('url');
        $this->assertStringContainsString(GoogleAuthService::GOOGLE_AUTH_URL, $url);
        $this->assertStringContainsString('mock-google-client-id', $url);
        $this->assertStringContainsString(urlencode('openid email profile'), $url);
    }

    /**
     * 3. Redirect endpoint redirects to Google OAuth URL.
     */
    public function test_redirect_endpoint_redirects_to_google(): void
    {
        $response = $this->get('/api/auth/google/redirect');

        $response->assertStatus(302);
        $this->assertStringContainsString(GoogleAuthService::GOOGLE_AUTH_URL, $response->headers->get('Location'));
    }

    /**
     * 4. Callback rejects request with missing state or invalid state (CSRF protection).
     */
    public function test_callback_fails_with_invalid_state(): void
    {
        $response = $this->get('/api/auth/google/callback?code=mock_code&state=invalid_or_expired_state');

        $response->assertStatus(302);
        $this->assertStringContainsString('oauth_error', $response->headers->get('Location'));
        $this->assertStringContainsString('Invalid+or+expired', $response->headers->get('Location'));
    }

    /**
     * 5. Callback handles Google authorization denial / cancel.
     */
    public function test_callback_handles_access_denied_from_google(): void
    {
        $response = $this->get('/api/auth/google/callback?error=access_denied&error_description=The+user+denied');

        $response->assertStatus(302);
        $this->assertStringContainsString('oauth_error', $response->headers->get('Location'));
        $this->assertStringContainsString('cancelled+or+denied', $response->headers->get('Location'));
    }

    /**
     * 6. New Google user is created with strict 'customer' role.
     */
    public function test_new_google_user_created_as_customer_with_sanctum_token(): void
    {
        $state = 'valid_oauth_state_123';
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        Http::fake([
            GoogleAuthService::GOOGLE_TOKEN_URL => Http::response([
                'access_token' => 'mock_google_access_token',
                'id_token'     => 'mock_id_token',
                'expires_in'   => 3600,
                'token_type'   => 'Bearer',
            ], 200),
            GoogleAuthService::GOOGLE_USERINFO_URL => Http::response([
                'sub'            => 'google_user_sub_1001',
                'email'          => 'newgoogleuser@example.com',
                'name'           => 'Abebe Bikila',
                'email_verified' => true,
            ], 200),
        ]);

        $response = $this->get('/api/auth/google/callback?code=valid_auth_code&state=' . $state);

        $response->assertStatus(302);
        $location = $response->headers->get('Location');
        $this->assertStringContainsString('auth_token=', $location);
        $this->assertStringContainsString('newgoogleuser%40example.com', $location);

        // Assert database record
        $user = User::where('email', 'newgoogleuser@example.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('google_user_sub_1001', $user->google_id);
        $this->assertEquals('Abebe Bikila', $user->name);
        $this->assertEquals('customer', $user->role); // MUST be customer
        $this->assertNull($user->password);
    }

    /**
     * 7. Existing google_id user logs in successfully without creating duplicate account.
     */
    public function test_existing_google_id_user_authenticates_correctly(): void
    {
        $existingUser = User::create([
            'name'      => 'Existing Google User',
            'email'     => 'existinggoogle@example.com',
            'google_id' => 'google_sub_existing_777',
            'password'  => null,
            'role'      => 'customer',
        ]);

        $state = 'valid_oauth_state_existing';
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        Http::fake([
            GoogleAuthService::GOOGLE_TOKEN_URL => Http::response([
                'access_token' => 'mock_google_access_token',
                'token_type'   => 'Bearer',
            ], 200),
            GoogleAuthService::GOOGLE_USERINFO_URL => Http::response([
                'sub'            => 'google_sub_existing_777',
                'email'          => 'existinggoogle@example.com',
                'name'           => 'Existing Google User',
                'email_verified' => true,
            ], 200),
        ]);

        $response = $this->get('/api/auth/google/callback?code=valid_code&state=' . $state);

        $response->assertStatus(302);
        $this->assertEquals(1, User::where('email', 'existinggoogle@example.com')->count());
        $this->assertEquals(1, User::where('google_id', 'google_sub_existing_777')->count());
    }

    /**
     * 8. Existing email user gets safely linked to Google identity without losing role or password.
     */
    public function test_existing_email_user_links_google_id_safely(): void
    {
        $existingOrganizer = User::create([
            'name'      => 'Organizer Dawit',
            'email'     => 'organizer.dawit@example.com',
            'password'  => bcrypt('secret_password_123'),
            'role'      => 'organizer',
        ]);

        $state = 'linking_state_456';
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        Http::fake([
            GoogleAuthService::GOOGLE_TOKEN_URL => Http::response([
                'access_token' => 'mock_google_access_token',
                'token_type'   => 'Bearer',
            ], 200),
            GoogleAuthService::GOOGLE_USERINFO_URL => Http::response([
                'sub'            => 'google_sub_dawit_999',
                'email'          => 'organizer.dawit@example.com',
                'name'           => 'Organizer Dawit',
                'email_verified' => true,
            ], 200),
        ]);

        $response = $this->get('/api/auth/google/callback?code=valid_code&state=' . $state);

        $response->assertStatus(302);

        $freshUser = $existingOrganizer->fresh();
        $this->assertEquals('google_sub_dawit_999', $freshUser->google_id);
        $this->assertEquals('organizer', $freshUser->role); // Preserves organizer role
        $this->assertNotNull($freshUser->password);         // Preserves password
    }

    /**
     * 9. Super Admin existing account links Google identity and preserves super-admin role.
     */
    public function test_super_admin_links_google_and_preserves_role(): void
    {
        $admin = User::create([
            'name'      => 'Admin User',
            'email'     => 'admin@tikethub.com',
            'password'  => bcrypt('admin_password_123'),
            'role'      => 'super-admin',
        ]);

        $state = 'admin_state_789';
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        Http::fake([
            GoogleAuthService::GOOGLE_TOKEN_URL => Http::response([
                'access_token' => 'mock_token',
                'token_type'   => 'Bearer',
            ], 200),
            GoogleAuthService::GOOGLE_USERINFO_URL => Http::response([
                'sub'            => 'google_admin_sub_123',
                'email'          => 'admin@tikethub.com',
                'name'           => 'Admin User',
                'email_verified' => true,
            ], 200),
        ]);

        $response = $this->get('/api/auth/google/callback?code=valid_code&state=' . $state);

        $response->assertStatus(302);
        $this->assertEquals('super-admin', $admin->fresh()->role);
    }

    /**
     * 10. POST exchange endpoint returns JSON with user & Sanctum token for SPA.
     */
    public function test_json_exchange_endpoint_returns_token_and_user(): void
    {
        $state = 'json_state_exchange_123';
        Cache::put('google_oauth_state:' . $state, true, now()->addMinutes(15));

        Http::fake([
            GoogleAuthService::GOOGLE_TOKEN_URL => Http::response([
                'access_token' => 'mock_token_json',
                'token_type'   => 'Bearer',
            ], 200),
            GoogleAuthService::GOOGLE_USERINFO_URL => Http::response([
                'sub'            => 'google_json_user_555',
                'email'          => 'jsonuser@example.com',
                'name'           => 'JSON User',
                'email_verified' => true,
            ], 200),
        ]);

        $response = $this->postJson('/api/auth/google/callback', [
            'code'  => 'mock_code_for_json',
            'state' => $state,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
            'token',
            'user' => ['id', 'name', 'email', 'role'],
        ]);
        $this->assertEquals('customer', $response->json('user.role'));
    }

    /**
     * 11. Sanctum token from Google authentication can be used on protected endpoints and revoked on logout.
     */
    public function test_sanctum_token_allows_authenticated_actions_and_logout(): void
    {
        $service = app(GoogleAuthService::class);
        $authData = $service->handleGoogleIdentity([
            'sub'            => 'google_test_sub_333',
            'email'          => 'testuser@example.com',
            'name'           => 'Test User',
            'email_verified' => true,
        ]);

        $token = $authData['token'];

        // Access protected route with Bearer token
        $bookingsResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/bookings');

        $bookingsResponse->assertStatus(200);

        // Logout
        $logoutResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/logout');

        $logoutResponse->assertStatus(200);

        // Clear in-memory auth guard cache for test simulation
        $this->app['auth']->forgetGuards();

        // Revoked token should no longer work
        $afterLogoutResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/bookings');

        $afterLogoutResponse->assertStatus(401);
    }
}
