<?php

namespace App\Services\Payment;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\Ticket;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * BookingExpiryService
 *
 * Authoritative service to handle automatic booking expiration and inventory release.
 *
 * Guarantees:
 * 1. Strict atomicity: All operations occur within database transactions with row-level locks.
 * 2. Idempotency & Double-release prevention: Row-level lock + status verification prevents releasing inventory twice.
 * 3. Payment safety: Never expires or releases tickets for bookings that have reached 'paid' status.
 * 4. Event status consistency: If event was 'sold_out', restocking available tickets resets status to 'active'.
 */
class BookingExpiryService
{
    public function __construct(private readonly \App\Services\NotificationService $notificationService)
    {
    }

    /**
     * Process all expired pending bookings.
     *
     * @param int $chunkSize
     * @return array{expired_bookings: int, released_tickets: int}
     */
    public function expireAllExpiredBookings(int $chunkSize = 100): array
    {
        $now = Carbon::now();
        $totalExpired = 0;
        $totalTicketsReleased = 0;

        // Query IDs of eligible bookings to avoid locking large datasets at once
        $expiredBookingIds = Booking::query()
            ->where('booking_status', Booking::BOOKING_PENDING)
            ->where('payment_status', Booking::PAYMENT_PENDING)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $now)
            ->pluck('id');

        Log::info('Found expired bookings eligible for processing.', [
            'count' => $expiredBookingIds->count(),
        ]);

        foreach ($expiredBookingIds as $bookingId) {
            try {
                $result = $this->expireBookingById($bookingId);
                if ($result['expired']) {
                    $totalExpired++;
                    $totalTicketsReleased += $result['released_tickets'];
                }
            } catch (Throwable $e) {
                Log::error('Failed to expire booking during batch run.', [
                    'booking_id' => $bookingId,
                    'error'      => $e->getMessage(),
                ]);
            }
        }

        return [
            'expired_bookings' => $totalExpired,
            'released_tickets' => $totalTicketsReleased,
        ];
    }

    /**
     * Expire a specific booking safely by ID.
     *
     * @param int $bookingId
     * @return array{expired: bool, released_tickets: int}
     */
    public function expireBookingById(int $bookingId): array
    {
        return DB::transaction(function () use ($bookingId) {
            // Lock the booking row for update to eliminate race conditions
            $booking = Booking::query()
                ->where('id', $bookingId)
                ->lockForUpdate()
                ->first();

            if (!$booking) {
                return ['expired' => false, 'released_tickets' => 0];
            }

            // Safety check 1: Never expire a booking that is already paid
            if ($booking->isPaid() || $booking->payment_status === Booking::PAYMENT_PAID) {
                Log::warning('Skipping expiration: booking is already paid.', [
                    'booking_id' => $booking->id,
                ]);
                return ['expired' => false, 'released_tickets' => 0];
            }

            // Safety check 2: Never re-expire a booking that is already cancelled or expired (Double release guard)
            if ($booking->isCancelled() || $booking->isExpired()) {
                return ['expired' => false, 'released_tickets' => 0];
            }

            // Safety check 3: Must be currently in pending status
            if ($booking->booking_status !== Booking::BOOKING_PENDING || $booking->payment_status !== Booking::PAYMENT_PENDING) {
                return ['expired' => false, 'released_tickets' => 0];
            }

            // Safety check 4: Verify expiration time actually passed
            if ($booking->expires_at && $booking->expires_at->isFuture()) {
                return ['expired' => false, 'released_tickets' => 0];
            }

            // Lock the associated event row for update
            $event = Event::query()
                ->where('id', $booking->event_id)
                ->lockForUpdate()
                ->first();

            $releasedQuantity = (int) $booking->ticket_quantity;

            if ($event && $releasedQuantity > 0) {
                // Safely restore available tickets without exceeding total tickets
                $newAvailable = min((int) $event->total_tickets, (int) $event->available_tickets + $releasedQuantity);
                $event->available_tickets = $newAvailable;

                // If event was marked sold_out, restore to active
                if ($event->status === 'sold_out' && $newAvailable > 0) {
                    $event->status = 'active';
                }

                $event->save();
            }

            // Mark any pending payments as cancelled/expired
            Payment::query()
                ->where('booking_id', $booking->id)
                ->where('status', Payment::STATUS_PENDING)
                ->update([
                    'status'         => Payment::STATUS_CANCELLED,
                    'cancelled_at'   => now(),
                    'failure_reason' => 'Booking expired before payment was completed.',
                ]);

            // Cancel any tickets that may have been provisionally issued
            Ticket::query()
                ->where('booking_id', $booking->id)
                ->where('status', Ticket::STATUS_ACTIVE)
                ->update([
                    'status' => Ticket::STATUS_CANCELLED,
                ]);

            // Authoritatively transition booking to EXPIRED state
            $booking->update([
                'booking_status' => Booking::BOOKING_EXPIRED,
                'payment_status' => Booking::PAYMENT_CANCELLED,
                'cancelled_at'   => now(),
            ]);

            // Notify user
            $this->notificationService->notifyBookingExpired($booking);

            Log::info('Booking expired and inventory released successfully.', [
                'booking_id'        => $booking->id,
                'event_id'          => $booking->event_id,
                'released_tickets'  => $releasedQuantity,
                'new_available'     => $event?->available_tickets,
            ]);

            return [
                'expired'          => true,
                'released_tickets' => $releasedQuantity,
            ];
        });
    }

    /**
     * Expire a booking model instance safely.
     *
     * @param Booking $booking
     * @return array{expired: bool, released_tickets: int}
     */
    public function expireBooking(Booking $booking): array
    {
        return $this->expireBookingById($booking->id);
    }
}
