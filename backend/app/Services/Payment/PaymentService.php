<?php

namespace App\Services\Payment;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\Ticket;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Exceptions\DuplicatePaymentException;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use App\Services\Payment\Providers\TelebirrPaymentService;
use App\Services\Payment\Providers\CbePaymentService;
use App\Services\Payment\Providers\CashPaymentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * PaymentService — Central payment orchestration layer.
 *
 * Controllers call PaymentService.
 * PaymentService delegates to the appropriate provider.
 * Provider-specific logic stays in the provider class.
 */
class PaymentService
{
    public function __construct(private readonly \App\Services\NotificationService $notificationService)
    {
    }

    /**
     * Resolve the correct payment provider for a given method.
     *
     * @throws \InvalidArgumentException
     */
    public function resolveProvider(string $paymentMethod): PaymentProviderInterface
    {
        return match ($paymentMethod) {
            'telebirr' => new TelebirrPaymentService(),
            'cbe'      => new CbePaymentService(),
            'cash'     => new CashPaymentService(),
            default    => throw new \InvalidArgumentException("Unknown payment method: {$paymentMethod}"),
        };
    }

    /**
     * Initiate a payment for a booking.
     *
     * - Validates no active payment already exists (idempotency guard).
     * - Creates a payment record in 'pending' state.
     * - Delegates to the provider to initiate with the external API.
     * - For cash: immediately generates tickets.
     *
     * Returns an array with payment details and provider instructions.
     *
     * @throws DuplicatePaymentException
     * @throws PaymentProviderNotConfiguredException
     * @throws \Throwable
     */
    public function initiatePayment(Booking $booking): array
    {
        // ── Idempotency: Prevent duplicate active payments ───────────────────
        $existingPendingPayment = $booking->payments()
            ->where('status', Payment::STATUS_PENDING)
            ->first();

        if ($existingPendingPayment) {
            // Return the existing pending payment reference instead of creating another
            Log::info('Returning existing pending payment.', [
                'booking_id'         => $booking->id,
                'payment_reference'  => $existingPendingPayment->reference,
            ]);
            return $this->buildInitiationResponse($existingPendingPayment, $booking, [
                'provider_reference' => $existingPendingPayment->provider_reference,
                'checkout_url'       => null,
                'payment_qr_data'    => null,
                'requires_redirect'  => false,
                'instructions'       => 'A pending payment already exists. Please complete it.',
                'metadata'           => [],
            ], isExisting: true);
        }

        $existingPaidPayment = $booking->payments()
            ->where('status', Payment::STATUS_PAID)
            ->first();

        if ($existingPaidPayment) {
            throw new DuplicatePaymentException(
                'This booking has already been paid. Duplicate payment is not allowed.'
            );
        }

        $provider = $this->resolveProvider($booking->payment_method);

        // ── Create payment record ────────────────────────────────────────────
        $payment = DB::transaction(function () use ($booking, $provider) {
            return Payment::create([
                'booking_id'     => $booking->id,
                'reference'      => $this->generateReference(),
                'provider'       => $provider->getProviderName(),
                'payment_method' => $booking->payment_method,
                'amount'         => $booking->total_price, // Server-calculated, never trusted from frontend
                'currency'       => 'ETB',
                'status'         => Payment::STATUS_PENDING,
            ]);
        });

        Log::info('Payment initiated.', [
            'booking_id'        => $booking->id,
            'payment_reference' => $payment->reference,
            'provider'          => $provider->getProviderName(),
            'amount'            => $payment->amount,
        ]);

        // ── Delegate to provider ─────────────────────────────────────────────
        $providerResult = $provider->initiate($payment, $booking);

        // Store provider reference if returned immediately
        if (!empty($providerResult['provider_reference'])) {
            $payment->update(['provider_reference' => $providerResult['provider_reference']]);
        }

        // ── Cash payments: generate ticket immediately ────────────────────────
        if ($provider->getProviderName() === 'cash') {
            $this->generateTickets($booking, $payment);
        }

        return $this->buildInitiationResponse($payment, $booking, $providerResult);
    }

    /**
     * Verify a payment's status with the provider.
     * This is the authoritative source of payment truth.
     *
     * Called:
     *   - After customer returns from provider redirect
     *   - By webhook handler
     *   - By polling endpoint
     *
     * @throws \Throwable
     */
    public function verifyPayment(Payment $payment): Payment
    {
        // Idempotency: already paid — nothing to do
        if ($payment->isPaid()) {
            return $payment;
        }

        $provider = $this->resolveProvider($payment->provider);
        $result   = $provider->verify($payment);

        return DB::transaction(function () use ($payment, $result) {
            if ($result['verified'] && $result['status'] === Payment::STATUS_PAID) {
                return $this->markPaymentPaid($payment, $result);
            }

            if ($result['status'] === Payment::STATUS_FAILED) {
                return $this->markPaymentFailed($payment, $result);
            }

            // Still pending — update provider reference if returned
            if (!empty($result['provider_reference'])) {
                $payment->update(['provider_reference' => $result['provider_reference']]);
            }

            return $payment->fresh();
        });
    }

    /**
     * Handle incoming webhook from a payment provider.
     * This is idempotent — safe to call multiple times.
     *
     * @throws \Throwable
     */
    public function handleWebhook(string $providerName, array $payload, array $headers): Payment
    {
        $provider = $this->resolveProvider($providerName);
        $result   = $provider->handleWebhook($payload, $headers);

        // Find the payment by our internal reference
        $reference = $result['internal_reference'] ?? null;
        if (!$reference) {
            throw new \RuntimeException('Webhook did not return a resolvable internal reference.');
        }

        $payment = Payment::where('reference', $reference)->firstOrFail();

        // Idempotency: already processed
        if ($payment->isPaid()) {
            Log::info('Webhook received for already-paid payment. Skipping.', [
                'payment_reference' => $payment->reference,
            ]);
            return $payment;
        }

        return DB::transaction(function () use ($payment, $result) {
            if ($result['verified'] && $result['status'] === Payment::STATUS_PAID) {
                return $this->markPaymentPaid($payment, $result);
            }

            if ($result['status'] === Payment::STATUS_FAILED) {
                return $this->markPaymentFailed($payment, $result);
            }

            return $payment->fresh();
        });
    }

    /**
     * Mark a payment as PAID and trigger ticket generation.
     * This is the ONLY place in the system that transitions payment to 'paid'.
     */
    private function markPaymentPaid(Payment $payment, array $result): Payment
    {
        // Idempotency guard
        if ($payment->isPaid()) {
            return $payment;
        }

        $payment->update([
            'status'             => Payment::STATUS_PAID,
            'provider_reference' => $result['provider_reference'] ?? $payment->provider_reference,
            'paid_at'            => now(),
            'provider_metadata'  => array_merge(
                $payment->provider_metadata ?? [],
                $result['metadata'] ?? []
            ),
        ]);

        // Update booking payment status
        $booking = $payment->booking;
        $booking->update([
            'payment_status'  => Booking::PAYMENT_PAID,
            'booking_status'  => Booking::BOOKING_CONFIRMED,
        ]);

        // Generate tickets (idempotent — won't create if already exist)
        $this->generateTickets($booking, $payment);

        // Dispatch notifications
        $this->notificationService->notifyPaymentSuccessful($payment);
        $this->notificationService->notifyBookingConfirmed($booking);

        Log::info('Payment marked as PAID. Tickets generated.', [
            'payment_reference' => $payment->reference,
            'booking_id'        => $booking->id,
        ]);

        return $payment->fresh();
    }

    /**
     * Mark a payment as FAILED.
     */
    private function markPaymentFailed(Payment $payment, array $result): Payment
    {
        $payment->update([
            'status'     => Payment::STATUS_FAILED,
            'failed_at'  => now(),
            'failure_reason' => $result['failure_reason'] ?? null,
            'provider_metadata' => array_merge(
                $payment->provider_metadata ?? [],
                $result['metadata'] ?? []
            ),
        ]);

        $booking = $payment->booking;
        $booking->update(['payment_status' => Booking::PAYMENT_FAILED]);

        Log::warning('Payment marked as FAILED.', [
            'payment_reference' => $payment->reference,
            'booking_id'        => $booking->id,
            'reason'            => $result['failure_reason'] ?? 'unknown',
        ]);

        return $payment->fresh();
    }

    /**
     * Generate tickets for a booking after payment is confirmed.
     *
     * Idempotent: Checks existing ticket count before creating new ones.
     * Generates one ticket per ticket_quantity in the booking.
     */
    public function generateTickets(Booking $booking, Payment $payment): void
    {
        $existingCount = $booking->tickets()->whereIn('status', [Ticket::STATUS_ACTIVE])->count();

        if ($existingCount >= $booking->ticket_quantity) {
            Log::info('Tickets already exist for booking. Skipping generation.', [
                'booking_id'      => $booking->id,
                'existing_count'  => $existingCount,
                'required_count'  => $booking->ticket_quantity,
            ]);
            return;
        }

        DB::transaction(function () use ($booking, $existingCount) {
            $remaining = $booking->ticket_quantity - $existingCount;
            $startSeat = $existingCount + 1;

            for ($i = 0; $i < $remaining; $i++) {
                Ticket::create([
                    'booking_id'        => $booking->id,
                    'ticket_identifier' => $this->generateTicketIdentifier(),
                    'ticket_token'      => $this->generateTicketToken(),
                    'seat_number'       => $startSeat + $i,
                    'status'            => Ticket::STATUS_ACTIVE,
                ]);
            }
        });

        // Tickets were just generated successfully, notify user.
        $this->notificationService->notifyTicketReady($booking);

        Log::info('Tickets generated.', [
            'booking_id'  => $booking->id,
            'count'       => $booking->ticket_quantity,
        ]);
    }

    /**
     * Cancel a payment (e.g. booking expired or customer cancelled).
     */
    public function cancelPayment(Payment $payment, string $reason = ''): Payment
    {
        if (!$payment->isPending()) {
            throw new \RuntimeException('Only pending payments can be cancelled.');
        }

        $payment->update([
            'status'       => Payment::STATUS_CANCELLED,
            'cancelled_at' => now(),
            'failure_reason' => $reason ?: 'Payment cancelled.',
        ]);

        $payment->booking->update(['payment_status' => Booking::PAYMENT_CANCELLED]);

        return $payment->fresh();
    }

    /**
     * Validate a ticket for event check-in.
     *
     * Returns:
     *   ['valid' => bool, 'ticket' => Ticket|null, 'message' => string]
     */
    public function validateTicket(string $ticketToken): array
    {
        $ticket = Ticket::where('ticket_token', $ticketToken)
            ->with(['booking.event', 'booking.user'])
            ->first();

        if (!$ticket) {
            return ['valid' => false, 'ticket' => null, 'message' => 'Ticket not found.'];
        }

        if ($ticket->isCancelled()) {
            return ['valid' => false, 'ticket' => $ticket, 'message' => 'This ticket has been cancelled.'];
        }

        if ($ticket->isUsed()) {
            return [
                'valid'   => false,
                'ticket'  => $ticket,
                'message' => 'This ticket has already been used. Entry denied.',
            ];
        }

        $booking = $ticket->booking;

        if (!$booking || $booking->isCancelled()) {
            return ['valid' => false, 'ticket' => $ticket, 'message' => 'Booking is cancelled.'];
        }

        // For digital payments, ensure payment is confirmed
        // Cash tickets are valid pending collection at door
        if ($booking->payment_method !== 'cash' && !$booking->isPaid()) {
            return ['valid' => false, 'ticket' => $ticket, 'message' => 'Payment not confirmed. Entry denied.'];
        }

        $event = $booking->event;
        if (!$event || $event->status === 'cancelled') {
            return ['valid' => false, 'ticket' => $ticket, 'message' => 'Event not found or cancelled.'];
        }

        return ['valid' => true, 'ticket' => $ticket, 'message' => 'Ticket is valid.'];
    }

    /**
     * Check in a ticket (mark as used).
     * Idempotent: cannot check in twice.
     *
     * @throws \RuntimeException
     */
    public function checkInTicket(string $ticketToken, string $checkedInBy = 'staff'): Ticket
    {
        $validation = $this->validateTicket($ticketToken);

        if (!$validation['valid']) {
            throw new \RuntimeException($validation['message']);
        }

        $ticket = $validation['ticket'];

        DB::transaction(function () use ($ticket, $checkedInBy) {
            $ticket->update([
                'status'         => Ticket::STATUS_USED,
                'checked_in_at'  => now(),
                'checked_in_by'  => $checkedInBy,
            ]);
        });

        Log::info('Ticket checked in.', [
            'ticket_identifier' => $ticket->ticket_identifier,
            'booking_id'        => $ticket->booking_id,
            'checked_in_by'     => $checkedInBy,
        ]);

        return $ticket->fresh();
    }

    // ─── Reference generation ──────────────────────────────────────────────────

    /**
     * Generate a unique internal payment reference.
     * Format: PAY-{timestamp}-{random}
     * Safe to share with providers as merchant order reference.
     */
    private function generateReference(): string
    {
        do {
            $reference = 'PAY-' . strtoupper(Str::random(4)) . '-' . time() . '-' . strtoupper(Str::random(6));
        } while (Payment::where('reference', $reference)->exists());

        return $reference;
    }

    /**
     * Generate a unique human-readable ticket identifier.
     * Format: TKT-{6 uppercase alphanumeric characters}
     */
    private function generateTicketIdentifier(): string
    {
        do {
            $identifier = 'TKT-' . strtoupper(Str::random(6));
        } while (Ticket::where('ticket_identifier', $identifier)->exists());

        return $identifier;
    }

    /**
     * Generate a secure opaque ticket token for QR code.
     *
     * SECURITY:
     * - This token is what goes inside the QR code.
     * - It is random and opaque — contains NO personal data, NO payment info.
     * - 64 characters of cryptographically random hex.
     */
    private function generateTicketToken(): string
    {
        do {
            $token = bin2hex(random_bytes(32)); // 64 hex chars
        } while (Ticket::where('ticket_token', $token)->exists());

        return $token;
    }

    // ─── Response building ─────────────────────────────────────────────────────

    private function buildInitiationResponse(
        Payment $payment,
        Booking $booking,
        array $providerResult,
        bool $isExisting = false
    ): array {
        return [
            'reference'          => $payment->reference,
            'payment_reference'  => $payment->reference,
            'status'             => $payment->status,
            'amount'             => (float) $payment->amount,
            'currency'           => $payment->currency,
            'provider'           => $payment->provider,
            'payment_method'     => $payment->payment_method,
            'checkout_url'       => $providerResult['checkout_url'] ?? null,
            'payment_qr_data'    => $providerResult['payment_qr_data'] ?? null,
            'requires_redirect'  => $providerResult['requires_redirect'] ?? false,
            'instructions'       => $providerResult['instructions'] ?? null,
            'is_existing'        => $isExisting,
        ];
    }
}
