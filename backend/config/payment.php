<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Payment Providers Configuration
    |--------------------------------------------------------------------------
    |
    | All payment provider credentials are read from environment variables.
    | NEVER hardcode credentials in this file.
    | NEVER commit credentials to source control.
    |
    */

    // ─── Telebirr (Ethio Telecom) ─────────────────────────────────────────────
    //
    // Requires official merchant account from Ethio Telecom.
    // Contact: Ethio Telecom developer/merchant services.
    //
    // Integration type: H5Pay / USSD Push (confirm with Ethio Telecom)
    //   - App ID and App Key are provided by Ethio Telecom
    //   - Public Key (RSA) is used to encrypt request payloads
    //   - Short Code is your merchant till/short code
    //
    'telebirr' => [
        'enabled'      => env('TELEBIRR_ENABLED', false),
        'mode'         => env('TELEBIRR_MODE', 'sandbox'), // sandbox or production
        'app_id'       => env('TELEBIRR_APP_ID', ''),
        'app_key'      => env('TELEBIRR_APP_KEY', ''),
        'public_key'   => env('TELEBIRR_PUBLIC_KEY', ''),
        'short_code'   => env('TELEBIRR_SHORT_CODE', ''),
        'base_url'     => env('TELEBIRR_BASE_URL', ''),
        'notify_url'   => env('TELEBIRR_NOTIFY_URL', env('APP_URL') . '/api/payments/webhook/telebirr'),
        'return_url'   => env('TELEBIRR_RETURN_URL', env('FRONTEND_URL') . '/payment/return'),
    ],

    // ─── Commercial Bank of Ethiopia (CBE) ───────────────────────────────────
    //
    // Requires official merchant account from CBE.
    // Contact: CBE merchant/corporate banking services.
    //
    // DISTINCTION: CBE merchant payment ≠ CBE Birr wallet.
    // Confirm integration type with CBE (hosted checkout, API, QR, etc.)
    //
    'cbe' => [
        'enabled'     => env('CBE_ENABLED', false),
        'mode'        => env('CBE_MODE', 'sandbox'), // sandbox or production
        'merchant_id' => env('CBE_MERCHANT_ID', ''),
        'api_key'     => env('CBE_API_KEY', ''),
        'api_secret'  => env('CBE_API_SECRET', ''),
        'base_url'    => env('CBE_BASE_URL', ''),
        'notify_url'  => env('CBE_NOTIFY_URL', env('APP_URL') . '/api/payments/webhook/cbe'),
        'return_url'  => env('CBE_RETURN_URL', env('FRONTEND_URL') . '/payment/return'),
    ],

    // ─── Booking reservation settings ────────────────────────────────────────
    'reservation' => [
        // How long (in minutes) an unpaid booking holds the tickets
        // before the reservation expires and tickets are released back.
        'expiry_minutes' => env('BOOKING_EXPIRY_MINUTES', 30),
    ],

];
