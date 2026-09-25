<?php

namespace App\Services\Payment\Contracts;

use App\Models\Booking;
use App\Models\Payment;

/**
 * Contract that every payment provider implementation must fulfil.
 *
 * Controllers interact with PaymentService, which delegates to a
 * provider that implements this interface.
 */
interface PaymentProviderInterface
{
    /**
     * Initiate a payment with the provider.
     *
     * Returns an array containing at minimum:
     *   [
     *     'provider_reference' => string|null,   // Provider's transaction ID (if available immediately)
     *     'checkout_url'       => string|null,   // Redirect URL for hosted checkout (if applicable)
     *     'payment_qr_data'    => string|null,   // QR payload for provider QR payment (if applicable)
     *     'instructions'       => string|null,   // Human-readable payment instructions
     *     'requires_redirect'  => bool,          // Whether frontend must redirect to checkout_url
     *     'metadata'           => array,         // Any additional provider response data
     *   ]
     *
     * @throws \App\Services\Payment\Exceptions\PaymentInitiationException
     */
    public function initiate(Payment $payment, Booking $booking): array;

    /**
     * Verify a payment with the provider using the internal reference.
     *
     * Returns an array:
     *   [
     *     'verified'            => bool,
     *     'provider_reference'  => string|null,
     *     'status'              => string,  // 'paid' | 'pending' | 'failed'
     *     'amount'              => float|null,
     *     'metadata'            => array,
     *   ]
     *
     * @throws \App\Services\Payment\Exceptions\PaymentVerificationException
     */
    public function verify(Payment $payment): array;

    /**
     * Process an inbound webhook/callback from the provider.
     *
     * Validates the payload authenticity (signature check if supported).
     * Returns normalized verification result (same shape as verify()).
     *
     * @param  array  $payload   Raw request payload
     * @param  array  $headers   Raw request headers (for signature validation)
     * @return array
     *
     * @throws \App\Services\Payment\Exceptions\PaymentWebhookException
     */
    public function handleWebhook(array $payload, array $headers): array;

    /**
     * Initiate a refund for a paid payment.
     *
     * Returns:
     *   [
     *     'refund_reference' => string|null,
     *     'status'           => string,   // 'refunded' | 'pending_refund'
     *     'metadata'         => array,
     *   ]
     *
     * @throws \App\Services\Payment\Exceptions\PaymentRefundException
     */
    public function refund(Payment $payment, float $amount, string $reason = ''): array;

    /**
     * Returns the provider identifier string (e.g. 'telebirr', 'cbe', 'chapa', 'cash').
     */
    public function getProviderName(): string;

    /**
     * Whether this provider is properly configured (credentials available).
     * Used to guard against using unconfigured providers in production.
     */
    public function isConfigured(): bool;
}
