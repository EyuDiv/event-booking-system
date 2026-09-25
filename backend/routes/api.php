<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\OrganizerBookingController;
use App\Http\Controllers\OrganizerEventController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\TicketController;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\GoogleAuthController;

/*
|--------------------------------------------------------------------------
| API Routes — Event Booking Platform (TiketHub)
|--------------------------------------------------------------------------
*/

// ─── Public authentication routes ─────────────────────────────────────────────
Route::middleware('throttle:auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);

    // Google OAuth 2.0 / OpenID Connect routes
    Route::get('/auth/google/url',      [GoogleAuthController::class, 'getUrl']);
    Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect']);
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback']);
    Route::post('/auth/google/callback', [GoogleAuthController::class, 'exchange']);
});

// ─── Public event discovery & details ─────────────────────────────────────────
Route::middleware('throttle:api')->group(function () {
    Route::get('/events',       [EventController::class, 'index']);
    Route::get('/events/{id}',  [EventController::class, 'show']);
});

// ─── Provider payment webhooks (public — provider POSTs here, not the user) ───
// These must be OUTSIDE auth middleware since payment providers don't have user tokens.
// Signature validation is handled inside PaymentController::webhook().
Route::post('/payments/webhook/{provider}', [PaymentController::class, 'webhook'])->middleware('throttle:webhooks');

// ─── Protected routes (require Sanctum bearer token) ──────────────────────────
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);

    // ─── Bookings ──────────────────────────────────────────────────────────────
    Route::post('/bookings',         [BookingController::class, 'store']);   // Create booking (pending)
    Route::get('/bookings',          [BookingController::class, 'index']);   // My Bookings list
    Route::get('/bookings/{id}',     [BookingController::class, 'show']);    // Single booking detail

    // ─── Payments ──────────────────────────────────────────────────────────────
    Route::post('/payments/initiate',                [PaymentController::class, 'initiate']); // Initiate payment
    Route::get('/payments/{reference}',              [PaymentController::class, 'show']);     // Get payment status
    Route::post('/payments/{reference}/verify',      [PaymentController::class, 'verify']);  // Verify payment with provider

    // Cancellation & Refunds
    Route::post('/bookings/{booking}/cancel',        [PaymentController::class, 'cancel']);
    Route::post('/bookings/{booking}/refund',        [PaymentController::class, 'requestRefund']);

    // ─── Tickets ───────────────────────────────────────────────────────────────
    Route::get('/bookings/{booking}/ticket',         [TicketController::class, 'index']);     // Get booking tickets (QR included)
    Route::get('/tickets/{token}/validate',          [TicketController::class, 'validate']); // Validate QR token
    Route::post('/tickets/{token}/checkin',          [TicketController::class, 'checkin'])->withoutMiddleware('throttle:api')->middleware('throttle:checkin');  // Check-in ticket at door

    // ─── Organizer Event Management ────────────────────────────────────────────
    Route::get('/organizer/events',              [OrganizerEventController::class, 'index']);    // List own events (incl. drafts)
    Route::post('/organizer/events',             [OrganizerEventController::class, 'store']);    // Create event
    Route::get('/organizer/events/{id}',         [OrganizerEventController::class, 'show']);     // Single event (organizer view)
    Route::put('/organizer/events/{id}',         [OrganizerEventController::class, 'update']);   // Update event
    Route::delete('/organizer/events/{id}',      [OrganizerEventController::class, 'destroy']); // Delete draft event

    // ─── Organizer Booking / Attendee Management ───────────────────────────────
    Route::get('/organizer/events/{event}/bookings', [OrganizerBookingController::class, 'index']); // Attendee list for an event

    // ─── Organizer Analytics ───────────────────────────────────────────────────
    Route::get('/organizer/analytics',                   [\App\Http\Controllers\OrganizerAnalyticsController::class, 'index']);
    Route::get('/organizer/events/{id}/analytics',       [\App\Http\Controllers\OrganizerAnalyticsController::class, 'show']);

    // ─── Notifications ──────────────────────────────────────────────────────────
    Route::get('/notifications',                         [\App\Http\Controllers\NotificationController::class, 'index']);
    Route::get('/notifications/unread-count',            [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all',               [\App\Http\Controllers\NotificationController::class, 'readAll']);
    Route::post('/notifications/{id}/read',              [\App\Http\Controllers\NotificationController::class, 'read']);
    // ─── Admin Management (Super Admin only) ────────────────────────────────────
    Route::middleware(['super-admin'])->prefix('admin')->group(function () {
        Route::get('/dashboard', [\App\Http\Controllers\Admin\AdminDashboardController::class, 'index']);
        
        Route::get('/users', [\App\Http\Controllers\Admin\AdminUserController::class, 'index']);
        Route::get('/users/{user}', [\App\Http\Controllers\Admin\AdminUserController::class, 'show']);
        Route::put('/users/{user}/role', [\App\Http\Controllers\Admin\AdminUserController::class, 'updateRole']);
        
        Route::get('/events', [\App\Http\Controllers\Admin\AdminEventController::class, 'index']);
        Route::get('/events/{event}', [\App\Http\Controllers\Admin\AdminEventController::class, 'show']);
        Route::put('/events/{event}/status', [\App\Http\Controllers\Admin\AdminEventController::class, 'updateStatus']);
        
        Route::get('/bookings', [\App\Http\Controllers\Admin\AdminBookingController::class, 'index']);
        Route::get('/bookings/{booking}', [\App\Http\Controllers\Admin\AdminBookingController::class, 'show']);
        
        Route::get('/payments', [\App\Http\Controllers\Admin\AdminPaymentController::class, 'index']);
        Route::get('/refunds', [\App\Http\Controllers\Admin\AdminRefundController::class, 'index']);
    });

});
