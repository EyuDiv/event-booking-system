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
 * Commercial Bank of Ethiopia (CBE) Payment Provider
 *
 * IMPORTANT:
 * This provider is intentionally NOT configured with fake API calls.
 *
 * DISTINCTION:
 *   - CBE Birr: Mobile wallet product (separate from bank payment)
 *   - CBE Merchant/Bank Integration: Direct bank merchant API
 *
 * CBE integration requires official merchant credentials from CBE:
 *   - Merchant/Biller ID
 *   - API Key / Secret
 *   - Notify/Callback URL
 *   - CBE API Base URL (official endpoint)
 *
 * Official documentation: Contact CBE developer/merchant services.
 *
 * Once official credentials are provided, implement:
 *   1. POST payment initiation to CBE API
 *   2. Handle hosted/redirect checkout or QR-based flow per CBE specification
 *   3. Receive webhook callback at /api/payments/webhook/cbe
 *   4. Validate callback signature/token
 *   5. Verify transaction via CBE query API
 *   6. Mark payment as paid only after server-side verification
 *
 * Environment variables required (set in .env when credentials received):
 *   CBE_MERCHANT_ID=
 *   CBE_API_KEY=
 *   CBE_API_SECRET=
 *   CBE_BASE_URL=
 *   CBE_NOTIFY_URL=
 *   CBE_RETURN_URL=
 */
class CbePaymentService implements PaymentProviderInterface
{
    private string $merchantId;
    private string $apiKey;
    private string $apiSecret;
    private string $baseUrl;
    private string $notifyUrl;
    private string $returnUrl;

    public function __construct()
    {
        $this->merchantId = config('payment.cbe.merchant_id', '');
        $this->apiKey     = config('payment.cbe.api_key', '');
        $this->apiSecret  = config('payment.cbe.api_secret', '');
        $this->baseUrl    = config('payment.cbe.base_url', '');
        $this->notifyUrl  = config('payment.cbe.notify_url', '');
        $this->returnUrl  = config('payment.cbe.return_url', '');
    }

    public function getProviderName(): string
    {
        return 'cbe';
    }

    public function isConfigured(): bool
    {
        return !empty($this->merchantId)
            && !empty($this->apiKey)
            && !empty($this->apiSecret)
            && !empty($this->baseUrl);
    }

    /**
     * Initiate a CBE payment.
     *
     * When credentials are available:
     *   - Build payment initiation request per CBE API specification
     *   - POST to CBE payment endpoint
     *   - Return checkout/redirect URL or QR data per CBE integration type
     */
    public function initiate(Payment $payment, Booking $booking): array
    {
        if (!$this->isConfigured()) {
            Log::warning('CBE payment initiation attempted but provider is not configured.', [
                'payment_reference' => $payment->reference,
                'booking_id'        => $booking->id,
            ]);

            throw new PaymentProviderNotConfiguredException(
                'CBE payment is not available. Official merchant credentials have not been configured. ' .
                'Please contact support or use an alternative payment method.'
            );
        }

        /**
         * TODO: Implement per official CBE API documentation.
         *
         * The CBE integration type (hosted, API, QR) must be confirmed with CBE.
         * Do NOT assume the payload structure without official documentation.
         */

        throw new PaymentInitiationException('CBE provider not yet configured.');
    }

    public function verify(Payment $payment): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('CBE is not configured.');
        }

        /**
         * TODO: Implement using CBE transaction query API.
         */

        throw new PaymentVerificationException('CBE verification not yet implemented.');
    }

    public function handleWebhook(array $payload, array $headers): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('CBE is not configured.');
        }

        /**
         * TODO: Implement when CBE credentials and documentation are available.
         *
         * Steps:
         * 1. Validate callback authenticity (signature/token per CBE spec)
         * 2. Extract transaction reference and status
         * 3. Call verify() to confirm with CBE API
         * 4. Return normalized result
         */

        throw new PaymentWebhookException('CBE webhook handling not yet implemented.');
    }

    public function refund(Payment $payment, float $amount, string $reason = ''): array
    {
        if (!$this->isConfigured()) {
            throw new PaymentProviderNotConfiguredException('CBE is not configured.');
        }

        /**
         * TODO: Implement using CBE refund API when available.
         */

        throw new PaymentRefundException('CBE refund not yet implemented.');
    }
}
