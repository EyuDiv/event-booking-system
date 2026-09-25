<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class BookingController extends Controller
{
    /**
     * Create a new booking for an authenticated customer.
     *
     * POST /api/bookings
     *
     * Protected by auth:sanctum.
     * Prevents overbooking using database row locking & transactions.
     * Authoritatively recalculates total price on the backend.
     *
     * PAYMENT FLOW:
     *   Creating a booking does NOT complete payment.
     *   Booking is created in 'pending' state.
     *   Customer must then call POST /api/payments/initiate to initiate payment.
     *   Payment status transitions from pending → paid only via backend verification.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated. Please sign in to book tickets.',
            ], 401);
        }

        // Only customers can perform normal customer bookings
        if ($user->role !== 'customer') {
            return response()->json([
                'message' => 'Only customer accounts can book tickets.',
            ], 403);
        }

        $validated = $request->validate([
            'event_id'        => ['required', 'integer', 'exists:events,id'],
            'ticket_quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'payment_method'  => ['required', 'string', 'in:telebirr,cbe,cash'],
        ]);

        try {
            $booking = DB::transaction(function () use ($user, $validated) {
                // Lock the event row for update to eliminate race conditions
                $event = Event::where('id', $validated['event_id'])
                    ->lockForUpdate()
                    ->first();

                if (!$event) {
                    throw ValidationException::withMessages([
                        'event_id' => ['The selected event does not exist.'],
                    ])->status(404);
                }

                if ($event->status !== 'active') {
                    throw ValidationException::withMessages([
                        'event_id' => ['This event is not available for booking.'],
                    ])->status(422);
                }

                $quantity = (int) $validated['ticket_quantity'];

                if ($event->available_tickets < $quantity) {
                    throw ValidationException::withMessages([
                        'ticket_quantity' => [
                            $event->available_tickets > 0
                                ? "Only {$event->available_tickets} ticket(s) remain available for this event."
                                : 'This event is currently sold out.',
                        ],
                    ])->status(422);
                }

                // Authoritative total price calculation: unit price * quantity
                $authoritativeTotal = round(((float) $event->ticket_price) * $quantity, 2);

                // Expiry: booking holds tickets for 30 minutes (configurable)
                $expiryMinutes = (int) config('payment.reservation.expiry_minutes', 30);

                // Create the booking record in PENDING state
                $newBooking = Booking::create([
                    'user_id'         => $user->id,
                    'event_id'        => $event->id,
                    'ticket_quantity' => $quantity,
                    'total_price'     => $authoritativeTotal,
                    'booking_status'  => Booking::BOOKING_PENDING,
                    'payment_status'  => Booking::PAYMENT_PENDING,
                    'payment_method'  => $validated['payment_method'],
                    'expires_at'      => now()->addMinutes($expiryMinutes),
                    'created_at'      => now(),
                ]);

                // Decrement inventory consistently (Option B: immediate decrement)
                $event->available_tickets -= $quantity;
                if ($event->available_tickets <= 0) {
                    $event->available_tickets = 0;
                    $event->status = 'sold_out';
                }
                $event->save();

                return [
                    'booking' => $newBooking,
                    'event'   => $event,
                ];
            });

            return response()->json([
                'message' => 'Booking reserved. Please complete payment to confirm your tickets.',
                'booking' => [
                    'id'              => $booking['booking']->id,
                    'user_id'         => $booking['booking']->user_id,
                    'event_id'        => $booking['booking']->event_id,
                    'ticket_quantity' => $booking['booking']->ticket_quantity,
                    'total_price'     => $booking['booking']->total_price,
                    'booking_status'  => $booking['booking']->booking_status,
                    'payment_status'  => $booking['booking']->payment_status,
                    'payment_method'  => $booking['booking']->payment_method,
                    'expires_at'      => $booking['booking']->expires_at,
                    'created_at'      => $booking['booking']->created_at,
                    'event'           => [
                        'id'           => $booking['event']->id,
                        'title'        => $booking['event']->title,
                        'category'     => $booking['event']->category,
                        'location'     => $booking['event']->location,
                        'event_date'   => $booking['event']->event_date,
                        'ticket_price' => $booking['event']->ticket_price,
                        'image_url'    => $booking['event']->image_url,
                    ],
                ],
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to complete your booking. Please try again.',
            ], 500);
        }
    }

    /**
     * List all bookings for the authenticated customer.
     *
     * GET /api/bookings
     *
     * Returns:
     *   - booking details
     *   - event details
     *   - payment status & latest payment reference
     *   - ticket information (only for paid or cash bookings)
     *
     * Authentication: required
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $bookings = Booking::with([
            'event:id,title,category,location,event_date,ticket_price,image_url,status',
            'latestPayment',
            'tickets' => function ($q) {
                $q->where('status', '!=', Ticket::STATUS_CANCELLED);
            },
        ])
        ->where('user_id', $user->id)
        ->orderByDesc('created_at')
        ->get();

        $formatted = $bookings->map(function (Booking $booking) {
            $canViewTickets = $booking->isPaid()
                || ($booking->payment_method === 'cash' && !$booking->isCancelled());

            return [
                'id'              => $booking->id,
                'event_id'        => $booking->event_id,
                'ticket_quantity' => $booking->ticket_quantity,
                'total_price'     => (float) $booking->total_price,
                'booking_status'  => $booking->booking_status,
                'payment_status'  => $booking->payment_status,
                'payment_method'  => $booking->payment_method,
                'expires_at'      => $booking->expires_at,
                'created_at'      => $booking->created_at,
                'event'           => $booking->event,
                'payment_reference' => $booking->latestPayment?->reference,
                'tickets'           => $canViewTickets
                    ? $booking->tickets->map(fn ($t) => [
                        'id'                => $t->id,
                        'ticket_identifier' => $t->ticket_identifier,
                        'ticket_token'      => $t->ticket_token,
                        'seat_number'       => $t->seat_number,
                        'status'            => $t->status,
                        'checked_in_at'     => $t->checked_in_at,
                    ])->values()
                    : [],
            ];
        });

        return response()->json([
            'bookings' => $formatted,
        ]);
    }

    /**
     * Get a single booking for the authenticated user.
     *
     * GET /api/bookings/{id}
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user    = $request->user();
        $booking = Booking::with([
            'event',
            'latestPayment',
            'tickets' => fn($q) => $q->where('status', '!=', Ticket::STATUS_CANCELLED),
        ])->find($id);

        if (!$booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        if ($booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        $canViewTickets = $booking->isPaid()
            || ($booking->payment_method === 'cash' && !$booking->isCancelled());

        return response()->json([
            'booking' => [
                'id'                => $booking->id,
                'event_id'          => $booking->event_id,
                'ticket_quantity'   => $booking->ticket_quantity,
                'total_price'       => (float) $booking->total_price,
                'booking_status'    => $booking->booking_status,
                'payment_status'    => $booking->payment_status,
                'payment_method'    => $booking->payment_method,
                'expires_at'        => $booking->expires_at,
                'created_at'        => $booking->created_at,
                'event'             => $booking->event,
                'payment_reference' => $booking->latestPayment?->reference,
                'tickets'           => $canViewTickets
                    ? $booking->tickets->map(fn ($t) => [
                        'id'                => $t->id,
                        'ticket_identifier' => $t->ticket_identifier,
                        'ticket_token'      => $t->ticket_token,
                        'seat_number'       => $t->seat_number,
                        'status'            => $t->status,
                        'checked_in_at'     => $t->checked_in_at,
                    ])->values()
                    : [],
            ],
        ]);
    }
}
