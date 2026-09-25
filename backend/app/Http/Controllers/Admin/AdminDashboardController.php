<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Event;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $usersCount = User::count();
        $eventsCount = Event::count();
        $activeEvents = Event::where('status', 'active')->count();
        $soldOutEvents = Event::where('status', 'sold_out')->count();

        $bookingsCount = Booking::count();
        $confirmedBookings = Booking::where('booking_status', 'confirmed')->count();
        $pendingBookings = Booking::where('booking_status', 'pending')->count();
        $cancelledBookings = Booking::where('booking_status', 'cancelled')->count();

        $ticketsSold = Ticket::where('status', 'active')->count();
        $checkedInTickets = Ticket::where('status', 'used')->whereNotNull('checked_in_at')->count();

        // Revenue is calculated from paid bookings
        $totalRevenue = Booking::where('payment_status', 'paid')
            ->sum('total_price');

        // Recent Activity
        $recentUsers = User::orderBy('created_at', 'desc')->take(5)->get(['id', 'name', 'email', 'role', 'created_at']);
        $recentBookings = Booking::with(['user:id,name,email', 'event:id,title'])
            ->orderBy('created_at', 'desc')->take(5)->get();
        $recentEvents = Event::with('organizer:id,name,email')
            ->orderBy('created_at', 'desc')->take(5)->get();

        // Analytics Chart Data (Registrations and Bookings by month for the last 6 months)
        $sixMonthsAgo = now()->subMonths(5)->startOfMonth();
        
        // Group users by month
        $usersByMonth = User::where('created_at', '>=', $sixMonthsAgo)
            ->get()
            ->groupBy(function ($item) { return $item->created_at->format('Y-m'); })
            ->map(function ($group, $month) { return ['month' => $month, 'count' => $group->count()]; })
            ->sortBy('month')
            ->values();

        // Group bookings by month
        $bookingsByMonth = Booking::where('created_at', '>=', $sixMonthsAgo)
            ->get()
            ->groupBy(function ($item) { return $item->created_at->format('Y-m'); })
            ->map(function ($group, $month) { return ['month' => $month, 'count' => $group->count()]; })
            ->sortBy('month')
            ->values();

        // Group revenue by month
        $revenueByMonth = Booking::where('payment_status', 'paid')
            ->where('created_at', '>=', $sixMonthsAgo)
            ->get()
            ->groupBy(function ($item) { return $item->created_at->format('Y-m'); })
            ->map(function ($group, $month) { return ['month' => $month, 'sum' => $group->sum('total_price')]; })
            ->sortBy('month')
            ->values();

        return response()->json([
            'metrics' => [
                'total_users' => $usersCount,
                'total_events' => $eventsCount,
                'active_events' => $activeEvents,
                'sold_out_events' => $soldOutEvents,
                'total_bookings' => $bookingsCount,
                'confirmed_bookings' => $confirmedBookings,
                'pending_bookings' => $pendingBookings,
                'cancelled_bookings' => $cancelledBookings,
                'tickets_sold' => $ticketsSold,
                'checked_in_tickets' => $checkedInTickets,
                'total_revenue' => (float) $totalRevenue,
            ],
            'charts' => [
                'users' => $usersByMonth,
                'bookings' => $bookingsByMonth,
                'revenue' => $revenueByMonth,
            ],
            'recent_activity' => [
                'users' => $recentUsers,
                'bookings' => $recentBookings,
                'events' => $recentEvents,
            ]
        ]);
    }
}
