# Google OAuth 2.0 / OpenID Connect Authentication Implementation Report

**Status:** `IMPLEMENTED — EXTERNAL GOOGLE OAUTH CONFIGURATION REQUIRED`  
**Platform:** TiketHub Event Booking System  
**Date:** September 24, 2026  

---

## 1. Executive Summary

A production-grade, secure Google OAuth 2.0 and OpenID Connect (OIDC) authentication pipeline has been integrated into TiketHub. The implementation preserves all existing email/password login, registration, logout, role hierarchy, and Laravel Sanctum token architectures without any regressions.

The "Continue with Google" button on the login screen is connected to official backend OAuth endpoints that securely handle authorization URL generation, state validation, authorization code exchange with Google, verified identity retrieval via Google's OpenID Connect UserInfo endpoint, safe account linking, role enforcement, and Sanctum token issuance.

---

## 2. Existing Authentication Architecture

TiketHub uses a decoupled SPA + REST API architecture:
- **Frontend (Next.js App Router):**
  - Sends email/password credentials to `POST /api/login` or registration payload to `POST /api/register`.
  - Receives `{ token, user: { id, name, email, role } }`.
  - Persists token and user object in `localStorage` (`auth_token` and `auth_user`).
  - Axios request interceptor attaches `Authorization: Bearer <auth_token>` to all protected API calls.
  - Role-aware client redirection directs users to `/` (customers), `/organizer/dashboard` (organizers), or `/admin` (super-admin).
- **Backend (Laravel + Sanctum):**
  - `AuthController` validates credentials and creates plain-text Sanctum personal access tokens (`$user->createToken('api-token')->plainTextToken`).
  - Passwords are encrypted with Bcrypt rounds = 12.
  - User roles are enforced via database column `role` (`customer`, `organizer`, `super-admin`).
  - Tokens are revoked on `POST /api/logout`.

---

## 3. Google OAuth Architecture

```
User clicks "Continue with Google"
        ↓
Frontend calls `GET /api/auth/google/url`
        ↓
Backend validates configuration, generates secure state (cached with 15m TTL),
and returns official Google OAuth authorization URL
        ↓
Browser redirects user to Google Consent Screen
        ↓
User authorizes TiketHub application
        ↓
Google redirects to backend `GET /api/auth/google/callback?code=...&state=...`
        ↓
Backend validates CSRF state token atomically (`Cache::pull`)
        ↓
Backend exchanges authorization code with `https://oauth2.googleapis.com/token`
using GOOGLE_CLIENT_SECRET (secret is NEVER exposed to frontend)
        ↓
Backend fetches verified user details from `https://openidconnect.googleapis.com/v1/userinfo`
        ↓
Backend executes account linking / creation:
  - If `google_id` exists → authenticate existing account
  - Else if verified `email` exists → safely link `google_id` to existing account (preserve existing role & password)
  - Else → create new user with strict default role `customer` (never organizer or super-admin)
        ↓
Backend creates Laravel Sanctum personal access token
        ↓
Backend redirects user to `${FRONTEND_URL}/login?auth_token=...&auth_user=...`
(or POST `/api/auth/google/callback` for SPA code exchange)
        ↓
Frontend stores `{ token, user }` via `setStoredAuth()`
        ↓
User is routed to appropriate dashboard based on `user.role`
```

---

## 4. Files Created & Modified

### Backend:
- `app/Services/GoogleAuthService.php` *(Created)*: Core OAuth service handling Google endpoints, token exchange, OIDC userinfo verification, state caching/validation, and identity handling.
- `app/Http/Controllers/GoogleAuthController.php` *(Created)*: Controller providing `GET /api/auth/google/url`, `GET /api/auth/google/redirect`, `GET /api/auth/google/callback`, and `POST /api/auth/google/callback`.
- `database/migrations/2026_09_24_000001_add_google_id_to_users_table.php` *(Created)*: Migration adding nullable unique `google_id` column to `users` table and making `password` nullable for OAuth-registered users.
- `app/Models/User.php` *(Modified)*: Added `google_id` to `$fillable`.
- `config/services.php` *(Modified)*: Added `google` service configuration (`client_id`, `client_secret`, `redirect_uri`).
- `routes/api.php` *(Modified)*: Registered Google OAuth routes under `throttle:auth` middleware.
- `.env.example` *(Modified)*: Added documentation for Google OAuth environment variables.
- `.env` *(Modified)*: Added configuration placeholders.
- `tests/Feature/GoogleAuthTest.php` *(Created)*: 11 comprehensive automated feature tests.

### Frontend:
- `lib/api.ts` *(Modified)*: Added `getGoogleAuthUrl()` and `exchangeGoogleAuthCode()` API helpers.
- `components/auth/LoginForm.tsx` *(Modified)*: Connected "Continue with Google" button with dynamic loading state, error alert handling, URL param parsing on return, and role-based redirect.
- `app/login/page.tsx` *(Modified)*: Added `Suspense` boundary for safe URL query parameter handling.
- `app/auth/callback/page.tsx` *(Created)*: Dedicated OAuth callback fallback handler.

---

## 5. Database Changes

Table: `users`
- Added column `google_id` (`VARCHAR(255) NULL UNIQUE`)
- Modified column `password` to be `NULLABLE` (OAuth-registered users who have not set an application password)

---

## 6. Security Protections & Account Linking Policy

1. **Client Secret Protection:** `GOOGLE_CLIENT_SECRET` exists strictly on the Laravel backend and is never sent to or bundled within Next.js.
2. **CSRF & Login CSRF Prevention:** A 40-character cryptographically secure `state` token is generated and stored in cache. Upon callback, `Cache::pull()` atomically validates and consumes the state, preventing replay and CSRF attacks.
3. **Identity Verification:** Identities are verified directly through Google's official OpenID Connect endpoint (`https://openidconnect.googleapis.com/v1/userinfo`). Homemade JWT parsing is avoided.
4. **Role Escalation Protection:** All newly registered Google users are strictly assigned `role = 'customer'`. Privilege escalation to `organizer` or `super-admin` via OAuth registration is prohibited.
5. **Safe Account Linking:** Existing users with matching verified emails have their `google_id` linked to their account while preserving their existing role (`customer`, `organizer`, or `super-admin`) and existing password.
6. **Graceful Handling of Unconfigured State:** If credentials are not set, the API returns a 503 response and the UI displays a clear notification to configure credentials instead of failing silently or faking authentication.

---

## 7. Required Google Cloud Console Configuration

To make Google OAuth live in production, follow these steps:

1. Visit [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your project (e.g. `TiketHub Platform`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - User Type: **External**
   - App Name: `TiketHub`
   - User Support Email & Developer Contact Email: Enter your support email.
   - Scopes: Add `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. Navigate to **APIs & Services** > **Credentials**:
   - Click **Create Credentials** > **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `TiketHub Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (Local Frontend)
     - `http://localhost:8000` (Local Backend)
     - `https://yourproductiondomain.com` (Production Frontend)
   - **Authorized redirect URIs**:
     - `http://localhost:8000/api/auth/google/callback` (Backend Callback)
     - `http://localhost:3000/login` (Frontend Login Direct)
     - `http://localhost:3000/auth/callback` (Frontend Callback Route)
     - `https://api.yourproductiondomain.com/api/auth/google/callback` (Production Backend)
5. Copy the **Client ID** and **Client Secret** into `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   ```

---

## 8. Verification & Test Results

### Backend Automated Feature Tests
Ran `php artisan test`:
```
Tests:    98 passed (375 assertions)
Duration: 20.73s
Result:   100% PASS
```

Specific Google Auth Feature Tests (`tests/Feature/GoogleAuthTest.php`):
1. `test_get_url_returns_503_when_credentials_unconfigured` — PASS
2. `test_get_url_returns_valid_authorization_url_and_stores_state` — PASS
3. `test_redirect_endpoint_redirects_to_google` — PASS
4. `test_callback_fails_with_invalid_state` — PASS
5. `test_callback_handles_access_denied_from_google` — PASS
6. `test_new_google_user_created_as_customer_with_sanctum_token` — PASS
7. `test_existing_google_id_user_authenticates_correctly` — PASS
8. `test_existing_email_user_links_google_id_safely` — PASS
9. `test_super_admin_links_google_and_preserves_role` — PASS
10. `test_json_exchange_endpoint_returns_token_and_user` — PASS
11. `test_sanctum_token_allows_authenticated_actions_and_logout` — PASS

### Route Verification
Ran `php artisan route:list --path=auth/google`:
- `GET|HEAD api/auth/google/callback` -> `GoogleAuthController@callback`
- `POST     api/auth/google/callback` -> `GoogleAuthController@exchange`
- `GET|HEAD api/auth/google/redirect` -> `GoogleAuthController@redirect`
- `GET|HEAD api/auth/google/url`      -> `GoogleAuthController@getUrl`

---

## 9. Current Status

**Status:** `IMPLEMENTED — EXTERNAL GOOGLE OAUTH CONFIGURATION REQUIRED`

The full production architecture, security controls, database schema, Sanctum token generation, account linking, role redirection, and frontend handlers are implemented and tested. To enable live end-to-end user logins with real Google accounts, obtain Google OAuth credentials from Google Cloud Console and paste them into `backend/.env`.
