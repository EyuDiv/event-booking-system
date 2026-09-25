<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Event;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\Ticket;
use App\Services\Payment\PaymentService;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use App\Services\Payment\Exceptions\DuplicatePaymentException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Foundation\Testing\RefreshDatabase;

class PaymentFoundationTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected User $organizer;
    protected Event $event;
    protected PaymentService $paymentService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::firstOrCreate(
            ['email' => 'test_verifier@example.com'],
            [
                'name' => 'Test Verifier',
                'password' => Hash::make('password123'),
                'role' => 'customer',
            ]
        );

        $this->organizer = User::firstOrCreate(
            ['email' => 'test_organizer@example.com'],
            [
                'name' => 'Test Organizer',
                'password' => Hash::make('password123'),
                'role' => 'organizer',
            ]
        );

        $this->event = Event::firstOrCreate(
            ['title' => 'Verification Concert 2026'],
            [
                'organizer_id' => $this->organizer->id,
                'description' => 'Test event for payment verification',
                'event_date' => now()->addDays(10),
                'location' => 'Millennium Hall, Addis Ababa',
                'ticket_price' => 250.00,
                'total_tickets' => 100,
                'available_tickets' => 100,
                'category' => 'Music',
                'status' => 'active',
            ]
        );

        $this->paymentService = app(PaymentService::class);
    }

    public function test_booking_model_and_amount_calculation()
    {
        $quantity = 3;
        $booking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => $quantity,
            'total_price' => $this->event->ticket_price * $quantity,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cash',
            'expires_at' => now()->addMinutes(30),
        ]);

        $this->assertNotNull($booking->id);
        $this->assertEquals(Booking::BOOKING_PENDING, $booking->booking_status);
        $this->assertEquals(750.00, (float)$booking->total_price);
        $this->assertEquals($this->user->id, $booking->user->id);
        $this->assertEquals($this->event->id, $booking->event->id);
    }

    public function test_cash_payment_and_ticket_generation()
    {
        $quantity = 2;
        $booking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => $quantity,
            'total_price' => $this->event->ticket_price * $quantity,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cash',
            'expires_at' => now()->addMinutes(30),
        ]);

        $initiateResult = $this->paymentService->initiatePayment($booking);

        $this->assertEquals(Payment::STATUS_PENDING, $initiateResult['status']);
        $this->assertStringStartsWith('PAY-', $initiateResult['payment_reference']);
        $this->assertNotEmpty($initiateResult['instructions']);

        $tickets = $booking->fresh()->tickets;
        $this->assertCount(2, $tickets);

        $ticket = $tickets->first();
        $this->assertStringStartsWith('TKT-', $ticket->ticket_identifier);
        $this->assertEquals(64, strlen($ticket->ticket_token));
        $this->assertTrue(ctype_xdigit($ticket->ticket_token));
        $this->assertEquals(Ticket::STATUS_ACTIVE, $ticket->status);
    }

    public function test_duplicate_payment_protection()
    {
        $booking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => $this->event->ticket_price,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cash',
            'expires_at' => now()->addMinutes(30),
        ]);

        // Create a paid payment record for this booking
        Payment::create([
            'booking_id'     => $booking->id,
            'reference'      => 'PAY-TEST-PAID-001',
            'provider'       => 'telebirr',
            'payment_method' => 'telebirr',
            'amount'         => $booking->total_price,
            'currency'       => 'ETB',
            'status'         => Payment::STATUS_PAID,
            'paid_at'        => now(),
        ]);

        $this->expectException(DuplicatePaymentException::class);
        $this->paymentService->initiatePayment($booking);
    }

    public function test_telebirr_and_cbe_throw_when_unconfigured()
    {
        $booking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => $this->event->ticket_price,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'telebirr',
            'expires_at' => now()->addMinutes(30),
        ]);

        $telebirrThrown = false;
        try {
            $this->paymentService->initiatePayment($booking);
        } catch (PaymentProviderNotConfiguredException $e) {
            $telebirrThrown = true;
        }
        $this->assertTrue($telebirrThrown, 'Telebirr threw unconfigured exception');

        $cbeBooking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => $this->event->ticket_price,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cbe',
            'expires_at' => now()->addMinutes(30),
        ]);

        $cbeThrown = false;
        try {
            $this->paymentService->initiatePayment($cbeBooking);
        } catch (PaymentProviderNotConfiguredException $e) {
            $cbeThrown = true;
        }
        $this->assertTrue($cbeThrown, 'CBE threw unconfigured exception');
    }

    public function test_ticket_validation_and_checkin()
    {
        $booking = Booking::create([
            'user_id' => $this->user->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => $this->event->ticket_price,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cash',
            'expires_at' => now()->addMinutes(30),
        ]);

        $this->paymentService->initiatePayment($booking);
        $ticket = $booking->fresh()->tickets->first();

        // Validate
        $val = $this->paymentService->validateTicket($ticket->ticket_token);
        $this->assertTrue($val['valid']);

        // Check in
        $cinTicket = $this->paymentService->checkInTicket($ticket->ticket_token);
        $this->assertEquals(Ticket::STATUS_USED, $cinTicket->status);

        // Double check in protection
        $this->expectException(\RuntimeException::class);
        $this->paymentService->checkInTicket($ticket->ticket_token);
    }

    public function test_api_endpoints_work()
    {
        // 1. Test Events list
        $response = $this->getJson('/api/events');
        $response->assertStatus(200);

        // 2. Test Event details
        $response = $this->getJson('/api/events/' . $this->event->id);
        $response->assertStatus(200);

        // 3. Test Authenticated My Bookings endpoint
        $response = $this->actingAs($this->user)->getJson('/api/bookings');
        $response->assertStatus(200);

        // 4. Test Authenticated Store Booking endpoint
        $response = $this->actingAs($this->user)->postJson('/api/bookings', [
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'payment_method' => 'cash',
        ]);
        $response->assertStatus(201);
        $bookingId = $response->json('booking.id');

        // 5. Test Payment Initiate endpoint (returns 201 for new payment)
        $payResp = $this->actingAs($this->user)->postJson('/api/payments/initiate', [
            'booking_id' => $bookingId,
            'provider' => 'cash',
        ]);
        $payResp->assertStatus(201);
        $paymentRef = $payResp->json('payment.reference');
        $this->assertNotEmpty($paymentRef);

        // 6. Test Booking Tickets endpoint
        $tktResp = $this->actingAs($this->user)->getJson('/api/bookings/' . $bookingId . '/ticket');
        $tktResp->assertStatus(200);
        $tickets = $tktResp->json('tickets');
        $this->assertNotEmpty($tickets);
        $token = $tickets[0]['ticket_token'];

        // 7. Test Ticket Validate endpoint (as organizer)
        $valResp = $this->actingAs($this->organizer)->getJson('/api/tickets/' . $token . '/validate');
        $valResp->assertStatus(200);
        $this->assertTrue($valResp->json('valid'));

        // 8. Test Ticket Checkin endpoint (as organizer)
        $chkResp = $this->actingAs($this->organizer)->postJson('/api/tickets/' . $token . '/checkin');
        $chkResp->assertStatus(200);
        $this->assertEquals('used', $chkResp->json('ticket.status'));
    }
}
