<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Ticket;
use App\Services\Payment\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class TicketController extends Controller
{
    public function __construct(private readonly PaymentService $paymentService)
    {
    }

    // ─── GET /api/bookings/{booking}/ticket ───────────────────────────────────

    /**
     * Retrieve ticket(s) for a specific booking.
     *
     * Authentication: required
     * Authorization:  booking must belong to authenticated user
     *
     * Returns ticket data only if payment is confirmed (paid)
     * OR for cash bookings (pay at door).
     *
     * Errors:
     *   401 — unauthenticated
     *   403 — not your booking
     *   404 — booking not found
     *   402 — payment required (not paid yet)
     */
    public function index(Request $request, int $bookingId): JsonResponse
    {
        $user    = $request->user();
        $booking = Booking::with(['tickets', 'event', 'payments'])->find($bookingId);

        if (!$booking) {
            return response()->json(['message' => 'Booking not found.'], 404);
        }

        if ($booking->user_id !== $user->id) {
            return response()->json(['message' => 'Access denied.'], 403);
        }

        // Only show tickets for paid bookings or cash (pay at door)
        $canViewTickets = $booking->isPaid()
            || ($booking->payment_method === 'cash' && !$booking->isCancelled());

        if (!$canViewTickets) {
            return response()->json([
                'message'        => 'Tickets are not available until payment is confirmed.',
                'payment_status' => $booking->payment_status,
            ], 402);
        }

        $tickets = $booking->tickets()
            ->where('status', '!=', Ticket::STATUS_CANCELLED)
            ->get()
            ->map(fn ($ticket) => $this->formatTicket($ticket, $booking));

        return response()->json([
            'booking_id' => $booking->id,
            'tickets'    => $tickets,
        ]);
    }

    // ─── GET /api/tickets/{token}/validate ───────────────────────────────────

    /**
     * Validate a ticket by its QR token.
     *
     * Authentication: required (staff/organizer/admin)
     * Used by event staff at the entrance to validate QR codes.
     *
     * Does NOT check in — only validates.
     * Use POST /api/tickets/{token}/checkin to check in.
     */
    public function validate(Request $request, string $token): JsonResponse
    {
        $validation = $this->paymentService->validateTicket($token);

        if ($validation['ticket']) {
            $this->authorizeOrganizerForTicket($request->user(), $validation['ticket']);
        }

        return response()->json([
            'valid'   => $validation['valid'],
            'message' => $validation['message'],
            'ticket'  => $validation['ticket']
                ? $this->formatTicketForValidation($validation['ticket'])
                : null,
        ], $validation['valid'] ? 200 : 422);
    }

    // ─── POST /api/tickets/{token}/checkin ───────────────────────────────────

    /**
     * Check in a ticket at event entrance.
     *
     * Authentication: required (staff must be authenticated)
     *
     * Prevents the same ticket from being used twice.
     *
     * Errors:
     *   404 — ticket not found
     *   422 — ticket invalid, used, cancelled, or payment not confirmed
     */
    public function checkin(Request $request, string $token): JsonResponse
    {
        $user = $request->user();
        $checkedInBy = $user?->name ?? 'staff';

        // Pre-validate to check authorization before committing check-in
        $validation = $this->paymentService->validateTicket($token);
        if ($validation['ticket']) {
            $this->authorizeOrganizerForTicket($user, $validation['ticket']);
        }

        try {
            $ticket = $this->paymentService->checkInTicket($token, $checkedInBy);

            return response()->json([
                'message'  => 'Check-in successful. Welcome!',
                'ticket'   => $this->formatTicketForValidation($ticket),
            ]);

        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Check-in failed. Please try again.'], 500);
        }
    }

    // ─── Formatting helpers ────────────────────────────────────────────────────

    private function authorizeOrganizerForTicket($user, Ticket $ticket): void
    {
        if (!$user) {
            abort(401, 'Unauthenticated.');
        }

        if ($user->role === 'super-admin') {
            return;
        }

        // Fetch booking and event to check ownership
        $booking = $ticket->relationLoaded('booking') ? $ticket->booking : $ticket->load('booking.event')->booking;
        $event = $booking?->event;

        if (!$event || $user->role !== 'organizer' || $event->organizer_id !== $user->id) {
            abort(403, 'You do not have permission to scan tickets for this event.');
        }
    }

    private function formatTicket(Ticket $ticket, Booking $booking): array
    {
        return [
            'id'                => $ticket->id,
            'ticket_identifier' => $ticket->ticket_identifier,
            'ticket_token'      => $ticket->ticket_token,  // QR code value (opaque token)
            'seat_number'       => $ticket->seat_number,
            'status'            => $ticket->status,
            'event'             => [
                'title'      => $booking->event?->title,
                'location'   => $booking->event?->location,
                'event_date' => $booking->event?->event_date,
            ],
            'checked_in_at'     => $ticket->checked_in_at,
        ];
    }

    private function formatTicketForValidation(Ticket $ticket): array
    {
        // For validation endpoint, include booking/event context but NOT sensitive data
        $booking = $ticket->relationLoaded('booking') ? $ticket->booking : $ticket->load('booking.event')->booking;

        return [
            'ticket_identifier' => $ticket->ticket_identifier,
            'status'            => $ticket->status,
            'seat_number'       => $ticket->seat_number,
            'checked_in_at'     => $ticket->checked_in_at,
            'event'             => [
                'title'      => $booking?->event?->title,
                'location'   => $booking?->event?->location,
                'event_date' => $booking?->event?->event_date,
            ],
            'booking' => [
                'id'             => $booking?->id,
                'payment_status' => $booking?->payment_status,
            ],
        ];
    }
}
