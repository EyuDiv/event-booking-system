<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\RefundRequest;
use App\Models\Ticket;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use App\Services\Payment\Exceptions\PaymentRefundException;
use App\Services\Payment\PaymentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class RefundService
{
    public function __construct(
        private readonly PaymentService $paymentService,
        private readonly \App\Services\NotificationService $notificationService
    ) {}

    /**
     * Check if a booking is eligible for cancellation and refund.
     * Throws an exception if not eligible.
     *
     * @throws \RuntimeException
     */
    public function validateRefundEligibility(Booking $booking): void
    {
        if (!$booking->isPaid()) {
            throw new \RuntimeException('Only paid bookings can be refunded.');
        }

        if ($booking->isCancelled()) {
            throw new \RuntimeException('This booking is already cancelled.');
        }

        if ($booking->refundRequest()->exists()) {
            throw new \RuntimeException('A refund request has already been submitted for this booking.');
        }

        $event = $booking->event;
        
        if (!$event) {
            throw new \RuntimeException('Event not found.');
        }

        $cutoffHours = config('refunds.cutoff_hours_before_event', 24);
        $cutoffTime = Carbon::now()->addHours($cutoffHours);

        if ($event->event_date <= $cutoffTime) {
            throw new \RuntimeException("Cancellations must be made at least {$cutoffHours} hours before the event starts.");
        }

        $usedTickets = $booking->tickets()->where('status', Ticket::STATUS_USED)->exists();
        if ($usedTickets) {
            throw new \RuntimeException('Tickets have already been used for check-in. Cannot process refund.');
        }
    }

    /**
     * Process a customer refund request.
     *
     * 1. Validates policy.
     * 2. Creates RefundRequest.
     * 3. Attempts provider refund (usually unconfigured for now).
     * 4. Cancels booking, invalidates tickets, and restores inventory.
     *
     * @throws \Throwable
     */
    public function processRefundRequest(Booking $booking, string $reason = ''): RefundRequest
    {
        // 1. Policy validation
        $this->validateRefundEligibility($booking);

        $payment = $booking->paidPayment()->first();
        if (!$payment) {
            throw new \RuntimeException('No successful payment found for this booking.');
        }

        return DB::transaction(function () use ($booking, $payment, $reason) {
            // 2. Create the refund request record
            $refundRequest = RefundRequest::create([
                'booking_id' => $booking->id,
                'payment_id' => $payment->id,
                'amount'     => $payment->amount,
                'status'     => RefundRequest::STATUS_REQUESTED,
                'reason'     => $reason,
            ]);

            // 3. Try to process live refund if provider is configured
            try {
                // This will throw PaymentProviderNotConfiguredException since live APIs aren't active yet.
                $this->paymentService->resolveProvider($payment->provider)->refund($payment, (float) $payment->amount, $reason);
                
                // If it succeeds (in the future):
                // $refundRequest->update(['status' => RefundRequest::STATUS_SUCCEEDED, 'processed_at' => now()]);
            } catch (PaymentProviderNotConfiguredException | PaymentRefundException $e) {
                // Expected for now. The refund stays in 'requested' state for manual handling.
                Log::info('Live refund unavailable. Refund request created for manual processing.', [
                    'booking_id' => $booking->id,
                    'error' => $e->getMessage()
                ]);
            }

            // 4. Cancel booking and restore inventory
            $this->cancelBookingAndRestoreInventory($booking);

            // 5. Notify the user
            $this->notificationService->notifyRefundRequested($refundRequest);
            $this->notificationService->notifyBookingCancelled($booking);

            return $refundRequest;
        });
    }

    /**
     * Internal method to securely cancel booking and restore tickets.
     */
    private function cancelBookingAndRestoreInventory(Booking $booking): void
    {
        $event = Event::where('id', $booking->event_id)->lockForUpdate()->first();
        
        if ($event && $booking->ticket_quantity > 0) {
            $newAvailable = min((int) $event->total_tickets, (int) $event->available_tickets + (int) $booking->ticket_quantity);
            $event->available_tickets = $newAvailable;
            
            if ($event->status === 'sold_out' && $newAvailable > 0) {
                $event->status = 'active';
            }
            $event->save();
        }

        // Invalidate all active tickets
        Ticket::where('booking_id', $booking->id)
            ->where('status', Ticket::STATUS_ACTIVE)
            ->update(['status' => Ticket::STATUS_CANCELLED]);

        // Mark booking as cancelled.
        // NOTE: payment_status is deliberately NOT updated to 'refunded' until the refund ACTUALLY clears.
        $booking->update([
            'booking_status' => Booking::BOOKING_CANCELLED,
            'cancelled_at'   => now(),
        ]);
    }
}
