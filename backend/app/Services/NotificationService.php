<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\RefundRequest;
use App\Models\User;
use App\Notifications\SystemNotification;

class NotificationService
{
    /**
     * Send a notification while ensuring idempotency.
     * Prevents duplicate notifications of the same type for the same related entity.
     */
    private function sendIdempotent(
        User $user,
        string $type,
        string $title,
        string $message,
        array $relatedData = [],
        string $deduplicationKey = null,
        mixed $deduplicationValue = null
    ): void {
        if ($deduplicationKey !== null && $deduplicationValue !== null) {
            $exists = $user->notifications()
                ->where('type', $type)
                ->whereJsonContains("data->related->{$deduplicationKey}", $deduplicationValue)
                ->exists();

            if ($exists) {
                return; // Already notified
            }
        }

        $user->notify(new SystemNotification($type, $title, $message, $relatedData));
    }

    public function notifyBookingConfirmed(Booking $booking): void
    {
        if (!$booking->user) return;
        
        $this->sendIdempotent(
            $booking->user,
            'BOOKING_CONFIRMED',
            'Booking Confirmed',
            "Your booking for {$booking->event?->title} has been confirmed.",
            ['booking_id' => $booking->id, 'event_id' => $booking->event_id],
            'booking_id',
            $booking->id
        );
    }

    public function notifyPaymentSuccessful(Payment $payment): void
    {
        $booking = $payment->booking;
        if (!$booking || !$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'PAYMENT_SUCCESSFUL',
            'Payment Successful',
            "Your payment of {$payment->amount} ETB was successful.",
            ['payment_id' => $payment->id, 'booking_id' => $booking->id],
            'payment_id',
            $payment->id
        );
    }

    public function notifyTicketReady(Booking $booking): void
    {
        if (!$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'TICKET_READY',
            'Tickets Ready',
            "Your tickets for {$booking->event?->title} are ready to be used.",
            ['booking_id' => $booking->id],
            'booking_id',
            $booking->id
        );
    }

    public function notifyBookingExpired(Booking $booking): void
    {
        if (!$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'BOOKING_EXPIRED',
            'Booking Expired',
            "Your pending booking for {$booking->event?->title} has expired.",
            ['booking_id' => $booking->id],
            'booking_id',
            $booking->id
        );
    }

    public function notifyBookingCancelled(Booking $booking): void
    {
        if (!$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'BOOKING_CANCELLED',
            'Booking Cancelled',
            "Your booking for {$booking->event?->title} has been cancelled.",
            ['booking_id' => $booking->id],
            'booking_id',
            $booking->id
        );
    }

    public function notifyRefundRequested(RefundRequest $refund): void
    {
        $booking = $refund->booking;
        if (!$booking || !$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'REFUND_REQUESTED',
            'Refund Requested',
            "Your refund request for {$refund->amount} ETB is being processed.",
            ['refund_id' => $refund->id, 'booking_id' => $booking->id],
            'refund_id',
            $refund->id
        );
    }
    
    public function notifyRefundSucceeded(RefundRequest $refund): void
    {
        $booking = $refund->booking;
        if (!$booking || !$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'REFUND_SUCCEEDED',
            'Refund Successful',
            "Your refund of {$refund->amount} ETB has been successfully processed.",
            ['refund_id' => $refund->id],
            'refund_id',
            $refund->id
        );
    }
    
    public function notifyRefundFailed(RefundRequest $refund): void
    {
        $booking = $refund->booking;
        if (!$booking || !$booking->user) return;

        $this->sendIdempotent(
            $booking->user,
            'REFUND_FAILED',
            'Refund Failed',
            "Your refund request for {$refund->amount} ETB could not be processed.",
            ['refund_id' => $refund->id],
            'refund_id',
            $refund->id
        );
    }

    public function notifyEventUpdated(Event $event): void
    {
        // Notify all users who have an active booking for this event
        $bookings = Booking::with('user')
            ->where('event_id', $event->id)
            ->whereIn('booking_status', [Booking::BOOKING_PENDING, Booking::BOOKING_CONFIRMED])
            ->get();

        foreach ($bookings as $booking) {
            if ($booking->user) {
                // We use updated_at timestamp as deduplication to avoid multiple identical update notifications
                $this->sendIdempotent(
                    $booking->user,
                    'EVENT_UPDATED',
                    'Event Updated',
                    "The event '{$event->title}' has been updated by the organizer.",
                    ['event_id' => $event->id, 'updated_at' => now()->timestamp],
                    'updated_at',
                    now()->timestamp
                );
            }
        }
    }

    public function notifyEventCancelled(Event $event): void
    {
        // Notify all users who have an active booking
        $bookings = Booking::with('user')
            ->where('event_id', $event->id)
            ->whereIn('booking_status', [Booking::BOOKING_PENDING, Booking::BOOKING_CONFIRMED])
            ->get();

        foreach ($bookings as $booking) {
            if ($booking->user) {
                $this->sendIdempotent(
                    $booking->user,
                    'EVENT_CANCELLED',
                    'Event Cancelled',
                    "The event '{$event->title}' has been cancelled by the organizer.",
                    ['event_id' => $event->id],
                    'event_id',
                    $event->id
                );
            }
        }
    }
}
