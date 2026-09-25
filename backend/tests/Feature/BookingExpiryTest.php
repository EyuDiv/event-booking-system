<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Event;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Ticket;
use App\Services\Payment\BookingExpiryService;
use App\Services\Payment\PaymentService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Foundation\Testing\RefreshDatabase;

class BookingExpiryTest extends TestCase
{
    use RefreshDatabase;

    protected User $customer;
    protected Event $event;
    protected BookingExpiryService $expiryService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::firstOrCreate(
            ['email' => 'customer_expiry_test@example.com'],
            [
                'name' => 'Expiry Customer',
                'password' => Hash::make('password123'),
                'role' => 'customer',
            ]
        );

        $this->event = Event::firstOrCreate(
            ['title' => 'Expiry Test Event 2026'],
            [
                'organizer_id' => $this->customer->id,
                'description' => 'Test event for automatic expiry testing',
                'event_date' => now()->addDays(5),
                'location' => 'Addis Ababa Exhibition Center',
                'ticket_price' => 100.00,
                'total_tickets' => 50,
                'available_tickets' => 50,
                'category' => 'Technology',
                'status' => 'active',
            ]
        );

        $this->expiryService = app(BookingExpiryService::class);
    }

    /**
     * 1. Pending booking before expiry remains unchanged.
     */
    public function test_pending_booking_before_expiry_remains_unchanged(): void
    {
        $initialAvailable = $this->event->available_tickets;

        $booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 2,
            'total_price'     => 200.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->addMinutes(25), // Future expiry
        ]);

        $this->event->decrement('available_tickets', 2);

        $result = $this->expiryService->expireAllExpiredBookings();

        $this->assertEquals(0, $result['expired_bookings']);
        $this->assertEquals(0, $result['released_tickets']);

        $booking->refresh();
        $this->assertEquals(Booking::BOOKING_PENDING, $booking->booking_status);
        $this->assertEquals(Booking::PAYMENT_PENDING, $booking->payment_status);

        $this->event->refresh();
        $this->assertEquals($initialAvailable - 2, $this->event->available_tickets);
    }

    /**
     * 2 & 3. Pending booking after expiry is expired and inventory is released.
     */
    public function test_expired_booking_is_marked_expired_and_inventory_released(): void
    {
        $this->event->update(['available_tickets' => 45]);

        $booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 5,
            'total_price'     => 500.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(5), // Expired 5 mins ago
        ]);

        $payment = Payment::create([
            'booking_id'     => $booking->id,
            'reference'      => 'PAY-EXP-TEST-001',
            'provider'       => 'telebirr',
            'payment_method' => 'telebirr',
            'amount'         => 500.00,
            'currency'       => 'ETB',
            'status'         => Payment::STATUS_PENDING,
        ]);

        $result = $this->expiryService->expireAllExpiredBookings();

        $this->assertEquals(1, $result['expired_bookings']);
        $this->assertEquals(5, $result['released_tickets']);

        $booking->refresh();
        $this->assertEquals(Booking::BOOKING_EXPIRED, $booking->booking_status);
        $this->assertEquals(Booking::PAYMENT_CANCELLED, $booking->payment_status);
        $this->assertNotNull($booking->cancelled_at);

        $payment->refresh();
        $this->assertEquals(Payment::STATUS_CANCELLED, $payment->status);

        $this->event->refresh();
        $this->assertEquals(50, $this->event->available_tickets); // 45 + 5 = 50
    }

    /**
     * 4. Running expiry twice releases inventory ONLY once.
     */
    public function test_running_expiry_twice_prevents_double_release(): void
    {
        $this->event->update(['available_tickets' => 40]);

        $booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 10,
            'total_price'     => 1000.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'cbe',
            'expires_at'      => now()->subMinutes(10),
        ]);

        // First run: releases 10 tickets
        $firstRun = $this->expiryService->expireAllExpiredBookings();
        $this->assertEquals(1, $firstRun['expired_bookings']);
        $this->assertEquals(10, $firstRun['released_tickets']);

        $this->event->refresh();
        $this->assertEquals(50, $this->event->available_tickets);

        // Second run: must NOT release tickets again
        $secondRun = $this->expiryService->expireAllExpiredBookings();
        $this->assertEquals(0, $secondRun['expired_bookings']);
        $this->assertEquals(0, $secondRun['released_tickets']);

        $this->event->refresh();
        $this->assertEquals(50, $this->event->available_tickets);
    }

    /**
     * 5. Paid booking is NEVER expired even if expires_at is past.
     */
    public function test_paid_booking_is_never_expired(): void
    {
        $this->event->update(['available_tickets' => 48]);

        $booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 2,
            'total_price'     => 200.00,
            'booking_status'  => Booking::BOOKING_CONFIRMED,
            'payment_status'  => Booking::PAYMENT_PAID,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(30), // Past expiration date
        ]);

        Payment::create([
            'booking_id'     => $booking->id,
            'reference'      => 'PAY-PAID-TEST-002',
            'provider'       => 'telebirr',
            'payment_method' => 'telebirr',
            'amount'         => 200.00,
            'currency'       => 'ETB',
            'status'         => Payment::STATUS_PAID,
            'paid_at'        => now()->subMinutes(35),
        ]);

        $result = $this->expiryService->expireAllExpiredBookings();

        $this->assertEquals(0, $result['expired_bookings']);
        $this->assertEquals(0, $result['released_tickets']);

        $booking->refresh();
        $this->assertEquals(Booking::BOOKING_CONFIRMED, $booking->booking_status);
        $this->assertEquals(Booking::PAYMENT_PAID, $booking->payment_status);

        $this->event->refresh();
        $this->assertEquals(48, $this->event->available_tickets);
    }

    /**
     * 6. Already cancelled booking is not processed incorrectly.
     */
    public function test_already_cancelled_booking_is_ignored(): void
    {
        $this->event->update(['available_tickets' => 50]);

        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 3,
            'total_price'     => 300.00,
            'booking_status'  => Booking::BOOKING_CANCELLED,
            'payment_status'  => Booking::PAYMENT_CANCELLED,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(40),
            'cancelled_at'    => now()->subMinutes(35),
        ]);

        $result = $this->expiryService->expireAllExpiredBookings();

        $this->assertEquals(0, $result['expired_bookings']);
        $this->assertEquals(0, $result['released_tickets']);

        $this->event->refresh();
        $this->assertEquals(50, $this->event->available_tickets);
    }

    /**
     * 7. Multiple expired bookings are all processed safely.
     */
    public function test_multiple_expired_bookings_are_processed_together(): void
    {
        $this->event->update(['available_tickets' => 35]);

        // Booking 1: 5 tickets
        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 5,
            'total_price'     => 500.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(15),
        ]);

        // Booking 2: 7 tickets
        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 7,
            'total_price'     => 700.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'cbe',
            'expires_at'      => now()->subMinutes(10),
        ]);

        // Booking 3: 3 tickets (not expired yet)
        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 3,
            'total_price'     => 300.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->addMinutes(15),
        ]);

        $result = $this->expiryService->expireAllExpiredBookings();

        $this->assertEquals(2, $result['expired_bookings']);
        $this->assertEquals(12, $result['released_tickets']); // 5 + 7 = 12

        $this->event->refresh();
        $this->assertEquals(47, $this->event->available_tickets); // 35 + 12 = 47
    }

    /**
     * 8. Event status transitions from sold_out back to active upon inventory release.
     */
    public function test_sold_out_event_becomes_active_when_inventory_is_released(): void
    {
        $this->event->update([
            'available_tickets' => 0,
            'status'            => 'sold_out',
        ]);

        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 4,
            'total_price'     => 400.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(5),
        ]);

        $this->expiryService->expireAllExpiredBookings();

        $this->event->refresh();
        $this->assertEquals(4, $this->event->available_tickets);
        $this->assertEquals('active', $this->event->status);
    }

    /**
     * 9. Artisan command bookings:expire runs successfully.
     */
    public function test_artisan_command_executes_successfully(): void
    {
        $this->event->update(['available_tickets' => 40]);

        Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 4,
            'total_price'     => 400.00,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'expires_at'      => now()->subMinutes(10),
        ]);

        $this->artisan('bookings:expire')
            ->expectsOutput('Checking for expired pending bookings...')
            ->expectsOutput('Successfully expired 1 booking(s) and released 4 ticket(s) back to inventory.')
            ->assertExitCode(0);

        $this->event->refresh();
        $this->assertEquals(44, $this->event->available_tickets);
    }
}
