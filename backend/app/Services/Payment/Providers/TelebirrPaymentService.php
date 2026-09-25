<?php

namespace App\Services\Payment\Providers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Exceptions\PaymentInitiationException;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use App\Services\Payment\Exceptions\PaymentVerificationException;
use App\Services\Payment\Exceptions\PaymentWebhookException;
use App\Services\Payment\Exceptions\PaymentRefundException;
use Illuminate\Support\Facades\Log;

/**
 * Telebirr Payment Provider
 *
 * IMPORTANT:
 * This provider is intentionally NOT configured with fake API calls.
 *
 * Telebirr integration requires official merchant credentials from Ethio Telecom:
 *   - Merchant App ID
 *   - App Key (for HMAC signature)
 *   - Public Key (for RSA encryption of request payload)
 *   - Short Code / Till Number
 *   - Notify URL (webhook endpoint)
 *   - Return URL (frontend redirect after payment)
 *
 * Official documentation: Contact Ethio Telecom developer portal.
 *
 * Once official credentials are provided, implement:
 *   1. RSA encrypt the request payload using Telebirr public key
 *   2. POST to Telebirr H5 Pay API endpoint
 *   3. Redirect customer to returned toPayUrl
 *   4. Receive webhook callback at /api/payments/webhook/telebirr
 *   5. Validate HMAC signature of callback
 *   6. Verify transaction via Telebirr query API
 *   7. Mark payment as paid only after server-side verification
 *
 * Environment variables required (set in .env when credentials received):
 *   TELEBIRR_APP_ID=
 *   TELEBIRR_APP_KEY=
 *   TELEBIRR_PUBLIC_KEY=
 *   TELEBIRR_SHORT_CODE=
 *   TELEBIRR_BASE_URL=
 *   TELEBIRR_NOTIFY_URL=
 *   TELEBIRR_RETURN_URL=
 */
class TelebirrPaymentService implements PaymentProviderInterface
{
    private string $appId;
    private string $appKey;
    private string $publicKey;
    private string $shortCode;
    private string $baseUrl;
    private string $notifyUrl;
    private string $returnUrl;

    public function __construct()
    {
        $this->appId     = config('payment.telebirr.app_id', '');
        $this->appKey    = config('payment.telebirr.app_key', '');
        $this->publicKey = config('payment.telebirr.public_key', '');
        $this->shortCode = config('payment.telebirr.short_code', '');
        $this->baseUrl   = config('payment.telebirr.base_url', '');
        $this->notifyUrl = config('payment.telebirr.notify_url', '');
        $this->returnUrl = config('payment.telebirr.return_url', '');
    }

    public function getProviderName(): string
    {
        return 'telebirr';
    }

    public function isConfigured(): bool
    {
        return !empty($this->appId)
            && !empty($this->appKey)
            && !empty($this->publicKey)
            && !empty($this->shortCode)
            && !empty($this->baseUrl);
    }

    /**
     * Initiate a Telebirr payment.
     *
     * When credentials are available:
     *   - Build ussd_push or h5pay request payload
     *   - RSA encrypt using Telebirr public key
     *   - POST to Telebirr endpoint
     *   - Return toPayUrl for frontend redirect
     *
     * Currently returns a structured "not configured" response that
     * the controller surfaces to the customer honestly.
     */
    public function initiate(Payment $payment, Booking $booking): array
    {
        if (!$this->isConfigured()) {
            Log::warning('Telebirr payment initiation attempted but provider is not configured.', [
                'payment_reference' => $payment->reference,
                'booking_id'        => $booking->id,
            ]);

            throw new PaymentProviderNotConfiguredException(
                'Telebirr payment is not available. Official merchant credentials have not been configured. ' .
                'Please contact support or use an alternative payment method.'
            );
        }

        /**
         * TODO: Implement when official credentials are available.
         *
         * $payload = $this->buildPayload($payment, $booking);
         * $encrypted = $this->encryptPayload($payload);
         * $response = Http::post($this->baseUrl . '/payment/initiate', [
         *     'appId'    => $this->appId,
         *     'sign'     => $this->sign($payload),
         *     'ussdPush' => $encrypted,
         * ]);
         * return [
         *     'provider_reference' => $response->json('data.merOrderNo'),
         *     'checkout_url'       => $response->json('data.toPayUrl'),
         *     'requires_redirect'  => true,
         *     'instructions'       => null,
         *     'payment_qr_data'    => null,
         *     'metadata'           => $response->json(),
         * ];
         */

        throw new PaymentInitiationException('Telebirr provider not yet configured.');
    }

    public function verify(Payment $payment): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('Telebirr is not configured.');
        }

        /**
         * TODO: Implement using Telebirr query transaction API.
         * Verify by merchant order number ($payment->reference).
         */

        throw new PaymentVerificationException('Telebirr verification not yet implemented.');
    }

    public function handleWebhook(array $payload, array $headers): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('Telebirr is not configured.');
        }

        /**
         * TODO: Implement when Telebirr credentials are available.
         *
         * Steps:
         * 1. Validate HMAC signature using app_key
         * 2. Extract transaction reference and status
         * 3. Call verify() to confirm with Telebirr API
         * 4. Return normalized result
         */

        throw new PaymentWebhookException('Telebirr webhook handling not yet implemented.');
    }

    public function refund(Payment $payment, float $amount, string $reason = ''): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('Telebirr is not configured.');
        }

        /**
         * TODO: Implement using Telebirr refund API when available.
         */

        throw new PaymentRefundException('Telebirr refund not yet implemented.');
    }

    // ─── Private helpers (to be implemented with official docs) ───────────────

    /**
     * Build the Telebirr payment request payload.
     * Implementation requires official Telebirr API documentation.
     */
    private function buildPayload(Payment $payment, Booking $booking): array
    {
        // TODO: Implement per official Telebirr documentation
        return [];
    }

    /**
     * RSA encrypt payload using Telebirr public key.
     * Implementation requires official Telebirr API documentation.
     */
    private function encryptPayload(array $payload): string
    {
        // TODO: Implement RSA encryption per official Telebirr docs
        return '';
    }

    /**
     * Generate HMAC signature for request.
     * Implementation requires official Telebirr API documentation.
     */
    private function sign(array $payload): string
    {
        // TODO: Implement per official Telebirr documentation
        return '';
    }
}
