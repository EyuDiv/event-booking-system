<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Throwable;
use Symfony\Component\HttpKernel\Exception\HttpException;

class OrganizerAnalyticsController extends Controller
{
    private function authorizeOrganizerRole(): void
    {
        $role = Auth::user()?->role;
        if (!in_array($role, ['organizer', 'super-admin'], true)) {
            abort(403, 'Access denied: organizer role required.');
        }
    }

    /**
     * GET /api/organizer/analytics
     */
    public function index(): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $userId = Auth::id();

            $query = Event::query();
            
            // Scope to organizer's own events (super-admin sees all)
            if (Auth::user()->role !== 'super-admin') {
                $query->where('organizer_id', $userId);
            }

            $events = $query->withCount([
                'bookings as total_bookings_count',
                'bookings as confirmed_bookings_count' => fn($q) => $q->where('booking_status', 'confirmed'),
                'bookings as pending_bookings_count' => fn($q) => $q->where('booking_status', 'pending'),
                'bookings as cancelled_bookings_count' => fn($q) => $q->where('booking_status', 'cancelled'),
                'bookings as expired_bookings_count' => fn($q) => $q->where('booking_status', 'expired'),
                'tickets as checked_in_tickets_count' => fn($q) => $q->where('status', 'used'),
            ])
            ->withSum(['payments as revenue' => fn($q) => $q->where('status', 'paid')], 'amount')
            ->orderByDesc('created_at')
            ->get();

            $overall = [
                'total_events' => $events->count(),
                'active_events' => $events->where('status', 'active')->count(),
                'draft_events' => $events->where('status', 'draft')->count(),
                'sold_out_events' => $events->where('status', 'sold_out')->count(),
                'total_bookings' => (int) $events->sum('total_bookings_count'),
                'confirmed_bookings' => (int) $events->sum('confirmed_bookings_count'),
                'pending_bookings' => (int) $events->sum('pending_bookings_count'),
                'cancelled_bookings' => (int) $events->sum('cancelled_bookings_count'),
                'expired_bookings' => (int) $events->sum('expired_bookings_count'),
                'total_tickets_available' => (int) $events->sum('total_tickets'),
                'total_tickets_sold' => (int) $events->sum(fn($e) => $e->total_tickets - $e->available_tickets),
                'checked_in_tickets' => (int) $events->sum('checked_in_tickets_count'),
                'total_revenue' => (float) $events->sum('revenue'),
            ];

            return response()->json([
                'overall' => $overall,
                'events' => $events
            ]);
        } catch (HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to load analytics.'], 500);
        }
    }

    /**
     * GET /api/organizer/events/{id}/analytics
     */
    public function show(int $id): JsonResponse
    {
        try {
            $this->authorizeOrganizerRole();
            $userId = Auth::id();

            $query = Event::query();
            
            if (Auth::user()->role !== 'super-admin') {
                $query->where('organizer_id', $userId);
            }

            $event = $query->withCount([
                'bookings as total_bookings_count',
                'bookings as confirmed_bookings_count' => fn($q) => $q->where('booking_status', 'confirmed'),
                'bookings as pending_bookings_count' => fn($q) => $q->where('booking_status', 'pending'),
                'bookings as cancelled_bookings_count' => fn($q) => $q->where('booking_status', 'cancelled'),
                'bookings as expired_bookings_count' => fn($q) => $q->where('booking_status', 'expired'),
                'tickets as checked_in_tickets_count' => fn($q) => $q->where('status', 'used'),
            ])
            ->withSum(['payments as revenue' => fn($q) => $q->where('status', 'paid')], 'amount')
            ->findOrFail($id);

            return response()->json([
                'event' => $event
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['message' => 'Event not found.'], 404);
        } catch (HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Unable to load event analytics.'], 500);
        }
    }
}
