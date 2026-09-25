<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class EventController extends Controller
{
    /**
     * Public event listing for the Home Page.
     *
     * GET /api/events
     *
     * Draft events are never returned. Sold-out events are included so the UI
     * can display them as not bookable.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Event::query()->whereIn('status', ['active', 'sold_out']);

            $search = trim((string) $request->query('search', ''));
            if ($search !== '') {
                $query->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('location', 'like', "%{$search}%");
                });
            }

            $category = trim((string) $request->query('category', ''));
            if ($category !== '' && strtolower($category) !== 'all') {
                $query->where('category', $category);
            }

            $dateFilter = trim((string) $request->query('date_filter', ''));
            if ($dateFilter === 'weekend') {
                $now = Carbon::now();
                $saturday = $now->isSaturday() ? $now->copy()->startOfDay() : $now->copy()->next(Carbon::SATURDAY)->startOfDay();
                $sunday = $saturday->copy()->addDay()->endOfDay();
                $query->whereBetween('event_date', [$saturday, $sunday]);
            } elseif ($dateFilter === 'next-week' || $dateFilter === 'next_week') {
                $now = Carbon::now();
                $nextMonday = $now->copy()->next(Carbon::MONDAY)->startOfDay();
                $nextSunday = $nextMonday->copy()->addDays(6)->endOfDay();
                $query->whereBetween('event_date', [$nextMonday, $nextSunday]);
            } elseif ($dateFilter === 'upcoming') {
                $query->where('event_date', '>=', Carbon::now());
            }

            $events = $query
                ->orderBy('event_date')
                ->get([
                    'id',
                    'title',
                    'category',
                    'description',
                    'location',
                    'event_date',
                    'ticket_price',
                    'total_tickets',
                    'available_tickets',
                    'status',
                    'image_url',
                    'organizer_id',
                    'created_at',
                ]);

            return response()->json([
                'events' => $events,
            ], 200);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to load events. Please try again later.',
            ], 500);
        }
    }

    /**
     * Public event details for the Event Details Page.
     *
     * GET /api/events/{id}
     *
     * Draft events are not public customer events and return 404.
     * Sensitive organizer info (e.g. passwords) is never exposed.
     */
    public function show(int $id): JsonResponse
    {
        try {
            $event = Event::with(['organizer:id,name,email'])
                ->whereIn('status', ['active', 'sold_out'])
                ->find($id);

            if (!$event) {
                return response()->json([
                    'message' => 'Event not found or unavailable.',
                ], 404);
            }

            return response()->json([
                'event' => $event,
            ], 200);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Unable to load event details. Please try again later.',
            ], 500);
        }
    }
}
