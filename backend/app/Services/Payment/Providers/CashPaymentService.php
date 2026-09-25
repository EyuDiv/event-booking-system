<?php

namespace App\Services\Payment\Providers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Exceptions\PaymentInitiationException;
use App\Services\Payment\Exceptions\PaymentRefundException;
use App\Services\Payment\Exceptions\PaymentVerificationException;
use App\Services\Payment\Exceptions\PaymentWebhookException;

/**
 * Cash Payment Provider (Pay at Door / Gate)
 *
 * Cash payments do not require an external provider API.
 * The payment is handled manually at the event venue.
 *
 * Flow:
 *   1. Customer selects "Pay at Door"
 *   2. Booking is created with payment_status = pending
 *   3. Payment record created with status = pending
 *   4. Ticket is generated immediately (provisional — pending cash collection)
 *   5. Event staff validates ticket at door
 *   6. Staff marks payment as paid after collecting cash (admin action)
 *
 * The ticket QR is valid but the ticket status is 'active' pending door payment.
 * Staff must be instructed to collect payment before admitting the customer.
 */
class CashPaymentService implements PaymentProviderInterface
{
    public function getProviderName(): string
    {
        return 'cash';
    }

    public function isConfigured(): bool
    {
        // Cash payments don't require external API configuration
        return true;
    }

    public function initiate(Payment $payment, Booking $booking): array
    {
        // Cash payments are initiated immediately — no external API call
        return [
            'provider_reference' => null,
            'checkout_url'       => null,
            'payment_qr_data'    => null,
            'requires_redirect'  => false,
            'instructions'       => 'Please present your ticket QR code at the venue entrance and pay cash to the event staff.',
            'metadata'           => ['provider' => 'cash', 'note' => 'Pay at Door'],
        ];
    }

    public function verify(Payment $payment): array
    {
        // Cash verification is done manually by staff (admin action)
        // This returns current status without external API call
        return [
            'verified'           => $payment->status === Payment::STATUS_PAID,
            'provider_reference' => null,
            'status'             => $payment->status,
            'amount'             => (float) $payment->amount,
            'metadata'           => ['provider' => 'cash'],
        ];
    }

    public function handleWebhook(array $payload, array $headers): array
    {
        // Cash payments don't have webhooks
        throw new PaymentWebhookException('Cash payment provider does not support webhooks.');
    }

    public function refund(Payment $payment, float $amount, string $reason = ''): array
    {
        // Cash refunds are manual processes
        throw new PaymentRefundException(
            'Cash refunds must be processed manually by event staff. ' .
            'Please contact the event organizer.'
        );
    }
}
