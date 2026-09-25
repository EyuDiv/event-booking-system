<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Organizer Booking / Attendee Management
 *
 * Routes (all within auth:sanctum middleware):
 *   GET /api/organizer/events/{event}/bookings
 *
 * Authorization rules:
 *   - organizer role: may only access bookings for their own events
 *   - super-admin role: may access any event's bookings
 *   - any other role: 403
 *
 * Sensitive data never exposed: passwords, Sanctum tokens, payment credentials,
 * provider metadata, provider secrets.
 *
 * ticket_token is NOT returned here — ticket scanning is handled by the
 * dedicated Gate Check-in portal which uses its own validated endpoints.
 */
class OrganizerBookingController extends Controller
{
    // ─── Authorization ────────────────────────────────────────────────────────

    /**
     * Abort with 403 unless the caller is an organizer or super-admin.
     */
    private function authorizeOrganizerRole(): void
    {
        $role = Auth::user()?->role;
        if (!in_array($role, ['organizer', 'super-admin'], true)) {
            abort(403, 'Access denied: organizer or super-admin role required.');
        }
    }

    /**
     * Find an event and verify ownership.
     * Super-admin bypasses the ownership check.
     * Returns 404 if event does not exist, 403 if organizer does not own it.
     */
    private function findOwnedEvent(int $eventId): Event
    {
        $event = Event::find($eventId);

        if (!$event) {
            abort(404, 'Event not found.');
        }

        if (Auth::user()->role !== 'super-admin' && $event->organizer_id !== Auth::id()) {
            abort(403, 'You do not have permission to manage this event\'s bookings.');
        }

        return $event;
    }

    // ─── Endpoint: List event bookings ────────────────────────────────────────

    /**
     * GET /api/organizer/events/{event}/bookings
     *
     * Returns all bookings for a given event, scoped to the organizer's ownership.
     *
     * Query params:
     *   - search          string   Filter by customer name or email (partial, case-insensitive)
     *   - booking_status  string   Filter by booking_status (pending|confirmed|cancelled|expired)
     *   - payment_status  string   Filter by payment_status (pending|paid|failed|cancelled|refunded)
     *   - ticket_status   string   Filter by ticket status (active|used|cancelled — checks any ticket)
     *   - per_page        int      Items per page (default 25, max 100)
     *   - page            int      Page number (default 1)
     */
    public function index(Request $request, int $event): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $eventModel = $this->findOwnedEvent($event);

            // ── Filters ──────────────────────────────────────────────────────
            $search        = trim((string) $request->query('search', ''));
            $bookingStatus = trim((string) $request->query('booking_status', ''));
            $paymentStatus = trim((string) $request->query('payment_status', ''));
            $ticketStatus  = trim((string) $request->query('ticket_status', ''));
            $perPage       = min((int) $request->query('per_page', 25), 100);

            $query = Booking::with([
                // Customer — never expose password (hidden in User model already)
                'user:id,name,email,role',
                // Latest payment attempt (for reference + status)
                'latestPayment',
                // Tickets for this booking (all non-cancelled by default)
                'tickets',
            ])
            ->where('event_id', $eventModel->id)
            ->orderByDesc('created_at');

            // Search by customer name or email
            if ($search !== '') {
                $query->whereHas('user', function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
                });
            }

            // Filter by booking_status
            if ($bookingStatus !== '') {
                $query->where('booking_status', $bookingStatus);
            }

            // Filter by payment_status
            if ($paymentStatus !== '') {
                $query->where('payment_status', $paymentStatus);
            }

            // Filter by ticket status (any ticket matching that status)
            if ($ticketStatus !== '') {
                $query->whereHas('tickets', function ($q) use ($ticketStatus) {
                    $q->where('status', $ticketStatus);
                });
            }

            $paginated = $query->paginate($perPage);

            // ── Format response ───────────────────────────────────────────────
            $formatted = collect($paginated->items())->map(function (Booking $booking) {
                return $this->formatBooking($booking);
            });

            return response()->json([
                'event' => [
                    'id'                => $eventModel->id,
                    'title'             => $eventModel->title,
                    'category'          => $eventModel->category,
                    'location'          => $eventModel->location,
                    'event_date'        => $eventModel->event_date,
                    'ticket_price'      => $eventModel->ticket_price,
                    'total_tickets'     => $eventModel->total_tickets,
                    'available_tickets' => $eventModel->available_tickets,
                    'status'            => $eventModel->status,
                    'image_url'         => $eventModel->image_url,
                ],
                'stats' => [
                    'total_bookings'     => $paginated->total(),
                    'tickets_sold'       => $eventModel->total_tickets - $eventModel->available_tickets,
                    'confirmed_bookings' => Booking::where('event_id', $eventModel->id)
                                                   ->where('booking_status', 'confirmed')->count(),
                    'pending_bookings'   => Booking::where('event_id', $eventModel->id)
                                                   ->where('booking_status', 'pending')->count(),
                    'checked_in_count'   => \App\Models\Ticket::whereHas('booking', fn($q) => $q->where('event_id', $eventModel->id))
                                                   ->where('status', 'used')->count(),
                ],
                'bookings'     => $formatted->values(),
                'pagination'   => [
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'per_page'     => $paginated->perPage(),
                    'total'        => $paginated->total(),
                    'from'         => $paginated->firstItem(),
                    'to'           => $paginated->lastItem(),
                ],
            ], 200);

        } catch (HttpException $e) {
            // Re-throw HTTP exceptions from abort() so Laravel handles them correctly
            throw $e;
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to load bookings.'], 500);
        }
    }

    // ─── Format helpers ───────────────────────────────────────────────────────

    /**
     * Shape a Booking into a safe organizer-facing response.
     * Never exposes: password, ticket_token, Sanctum tokens, payment secrets.
     */
    private function formatBooking(Booking $booking): array
    {
        return [
            'id'               => $booking->id,
            'ticket_quantity'  => $booking->ticket_quantity,
            'total_price'      => (float) $booking->total_price,
            'booking_status'   => $booking->booking_status,
            'payment_status'   => $booking->payment_status,
            'payment_method'   => $booking->payment_method,
            'created_at'       => $booking->created_at,
            'expires_at'       => $booking->expires_at,

            // Customer (password is hidden by User model $hidden)
            'customer' => $booking->user ? [
                'id'    => $booking->user->id,
                'name'  => $booking->user->name,
                'email' => $booking->user->email,
            ] : null,

            // Latest payment attempt — reference only, no secrets
            'payment' => $booking->latestPayment ? [
                'reference'      => $booking->latestPayment->reference,
                'status'         => $booking->latestPayment->status,
                'provider'       => $booking->latestPayment->provider,
                'payment_method' => $booking->latestPayment->payment_method,
                'amount'         => (float) $booking->latestPayment->amount,
                'currency'       => $booking->latestPayment->currency,
                'paid_at'        => $booking->latestPayment->paid_at,
                'failed_at'      => $booking->latestPayment->failed_at,
                // provider_reference and provider_metadata intentionally omitted
            ] : null,

            // Tickets — ticket_token intentionally omitted
            // (scanning is handled exclusively by the Gate Check-in portal)
            'tickets' => $booking->tickets->map(fn (Ticket $t) => [
                'id'                => $t->id,
                'ticket_identifier' => $t->ticket_identifier,
                'seat_number'       => $t->seat_number,
                'status'            => $t->status,
                'checked_in_at'     => $t->checked_in_at,
            ])->values(),
        ];
    }
}
