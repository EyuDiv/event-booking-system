<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Payment;
use App\Services\Payment\Exceptions\DuplicatePaymentException;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use App\Services\Payment\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $paymentService)
    {
    }

    // ─── POST /api/payments/initiate ──────────────────────────────────────────

    /**
     * Initiate a payment for an existing booking.
     *
     * Authentication: required (auth:sanctum)
     * Authorization:  booking must belong to the authenticated user
     *
     * Request body:
     *   { "booking_id": 12 }
     *
     * The backend:
     *   - Validates booking ownership
     *   - Validates booking/event status
     *   - Calculates amount from DB (never trusts frontend total)
     *   - Creates payment record
     *   - Returns provider checkout URL / instructions
     *
     * Errors:
     *   401 — unauthenticated
     *   403 — booking does not belong to user
     *   404 — booking not found
     *   409 — payment already paid (duplicate)
     *   422 — validation error
     *   503 — provider not configured
     *   500 — unexpected error
     */
    public function initiate(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
        ]);

        $booking = Booking::with(['event', 'payments'])->find($validated['booking_id']);

        // ── Authorization: booking must belong to this user ──────────────────
        if ($booking->user_id !== $user->id) {
            return response()->json(['message' => 'You do not have permission to pay for this booking.'], 403);
        }

        // ── Validation: booking must not be cancelled ─────────────────────────
        if ($booking->isCancelled() || $booking->isExpired()) {
            return response()->json([
                'message' => 'This booking is no longer active and cannot be paid.',
            ], 422);
        }

        // ── Validation: event must still be active ────────────────────────────
        if (!$booking->event || !in_array($booking->event->status, ['active', 'sold_out'], true)) {
            return response()->json([
                'message' => 'The event associated with this booking is no longer available.',
            ], 422);
        }

        try {
            $result = $this->paymentService->initiatePayment($booking);

            return response()->json([
                'message' => 'Payment initiated.',
                'payment' => $result,
            ], 201);

        } catch (DuplicatePaymentException $e) {
            return response()->json(['message' => $e->getMessage()], 409);

        } catch (PaymentProviderNotConfiguredException $e) {
            Log::warning('Payment provider not configured.', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => $e->getMessage(),
                'provider_configured' => false,
            ], 503);

        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to initiate payment. Please try again.'], 500);
        }
    }

    // ─── GET /api/payments/{reference} ───────────────────────────────────────

    /**
     * Get payment status by internal reference.
     *
     * Authentication: required
     * Authorization:  payment's booking must belong to authenticated user
     *
     * Errors:
     *   401 — unauthenticated
     *   403 — not your booking
     *   404 — payment not found
     */
    public function show(Request $request, string $reference): JsonResponse
    {
        $user = $request->user();

        $payment = Payment::with('booking')->where('reference', $reference)->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment not found.'], 404);
        }

        if ($payment->booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        return response()->json([
            'payment' => $this->formatPayment($payment),
        ]);
    }

    // ─── POST /api/payments/{reference}/verify ────────────────────────────────

    /**
     * Trigger backend payment verification for a specific payment.
     *
     * Called after customer returns from provider checkout.
     * The backend verifies with the provider — NOT the frontend claim.
     *
     * Authentication: required
     * Authorization:  booking must belong to user
     */
    public function verify(Request $request, string $reference): JsonResponse
    {
        $user = $request->user();

        $payment = Payment::with('booking')->where('reference', $reference)->first();

        if (!$payment) {
            return response()->json(['message' => 'Payment not found.'], 404);
        }

        if ($payment->booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        try {
            $payment = $this->paymentService->verifyPayment($payment);

            return response()->json([
                'message' => 'Payment verification completed.',
                'payment' => $this->formatPayment($payment),
            ]);

        } catch (PaymentProviderNotConfiguredException $e) {
            // Cash payments or unconfigured providers
            return response()->json([
                'message' => $e->getMessage(),
                'payment' => $this->formatPayment($payment->fresh()),
                'provider_configured' => false,
            ], 200);

        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Verification failed. Please try again.'], 500);
        }
    }

    // ─── POST /api/payments/webhook/{provider} ────────────────────────────────

    /**
     * Handle incoming payment provider webhooks/callbacks.
     *
     * Authentication: NOT required (provider posts here, not the user).
     * Security: Signature/HMAC validation is handled inside the provider.
     *
     * This endpoint must be excluded from CSRF protection (stateless API).
     */
    public function webhook(Request $request, string $provider): JsonResponse
    {
        Log::info('Webhook received.', [
            'provider' => $provider,
            'ip'       => $request->ip(),
        ]);

        $allowedProviders = ['telebirr', 'cbe'];

        if (!in_array($provider, $allowedProviders, true)) {
            return response()->json(['message' => 'Unknown provider.'], 404);
        }

        try {
            $this->paymentService->handleWebhook(
                $provider,
                $request->all(),
                $request->headers->all()
            );

            // Always return 200 to the provider so they stop retrying
            return response()->json(['message' => 'Webhook received.'], 200);

        } catch (Throwable $e) {
            // Log but still return 200 to prevent provider retry storms
            report($e);
            Log::error('Webhook processing failed.', [
                'provider' => $provider,
                'error'    => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Webhook received.'], 200);
        }
    }

    // ─── POST /api/bookings/{booking}/cancel ──────────────────────────────────

    /**
     * Cancel a booking and its pending payment.
     *
     * Authentication: required
     * Authorization:  booking must belong to user
     *
     * Cancellation policy:
     *   - Cannot cancel a booking that is already paid
     *     (requires refund flow, not cancellation)
     *   - Can cancel pending bookings
     */
    public function cancel(Request $request, int $bookingId, \App\Services\NotificationService $notificationService): JsonResponse
    {
        $user    = $request->user();
        $booking = Booking::with('payments')->find($bookingId);

        if (!$booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        if ($booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        if ($booking->isCancelled()) {
            return response()->json(['message' => 'Booking is already cancelled.'], 422);
        }

        if ($booking->isPaid()) {
            return response()->json([
                'message' => 'This booking has already been paid. To cancel, please contact support for a refund.',
            ], 422);
        }

        try {
            DB::transaction(function () use ($booking) {
                // Cancel any pending payment
                $pendingPayment = $booking->payments()->where('status', Payment::STATUS_PENDING)->first();
                if ($pendingPayment) {
                    $this->paymentService->cancelPayment($pendingPayment, 'Cancelled by customer.');
                }

                // Restore event inventory
                $event = Event::where('id', $booking->event_id)->lockForUpdate()->first();
                if ($event && $booking->ticket_quantity > 0) {
                    $newAvailable = min((int) $event->total_tickets, (int) $event->available_tickets + (int) $booking->ticket_quantity);
                    $event->available_tickets = $newAvailable;
                    if ($event->status === 'sold_out' && $newAvailable > 0) {
                        $event->status = 'active';
                    }
                    $event->save();
                }

                // Cancel any provisionally active tickets
                Ticket::where('booking_id', $booking->id)
                    ->where('status', Ticket::STATUS_ACTIVE)
                    ->update(['status' => Ticket::STATUS_CANCELLED]);

                $booking->update([
                    'booking_status' => Booking::BOOKING_CANCELLED,
                    'payment_status' => Booking::PAYMENT_CANCELLED,
                    'cancelled_at'   => now(),
                ]);
            });

            $notificationService->notifyBookingCancelled($booking);

            return response()->json(['message' => 'Booking cancelled successfully.']);

        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to cancel booking. Please try again.'], 500);
        }
    }

    // ─── POST /api/bookings/{booking}/refund ──────────────────────────────────

    /**
     * Request a cancellation and refund for a paid booking.
     *
     * Authentication: required
     * Authorization:  booking must belong to user
     */
    public function requestRefund(Request $request, int $bookingId, \App\Services\RefundService $refundService): JsonResponse
    {
        $user    = $request->user();
        $booking = Booking::with('payments')->find($bookingId);

        if (!$booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        if ($booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        try {
            $refundRequest = $refundService->processRefundRequest($booking, $request->input('reason', 'Customer requested cancellation.'));

            return response()->json([
                'message' => 'Cancellation successful. Your refund request has been received and is being processed.',
                'refund_request' => $refundRequest
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to process refund request. Please try again later.'], 500);
        }
    }

    // ─── Formatting helper ────────────────────────────────────────────────────

    private function formatPayment(Payment $payment): array
    {
        return [
            'reference'          => $payment->reference,
            'status'             => $payment->status,
            'provider'           => $payment->provider,
            'payment_method'     => $payment->payment_method,
            'amount'             => (float) $payment->amount,
            'currency'           => $payment->currency,
            'provider_reference' => $payment->provider_reference,
            'paid_at'            => $payment->paid_at,
            'failed_at'          => $payment->failed_at,
        ];
    }
}
