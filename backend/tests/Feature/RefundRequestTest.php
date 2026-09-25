<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $organizer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->customer = User::factory()->create(['role' => 'customer']);
        $this->organizer = User::factory()->create(['role' => 'organizer']);
    }

    private function createEvent(int $daysAway = 10, int $availableTickets = 100): Event
    {
        return Event::create([
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Test Location',
            'event_date' => Carbon::now()->addDays($daysAway),
            'ticket_price' => 50.00,
            'total_tickets' => 100,
            'available_tickets' => $availableTickets,
            'status' => 'active',
            'organizer_id' => $this->organizer->id,
        ]);
    }

    private function createPaidBooking(Event $event, int $quantity = 2): Booking
    {
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $event->id,
            'ticket_quantity' => $quantity,
            'total_price' => 50.00 * $quantity,
            'booking_status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'telebirr',
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'PAY-TEST-' . uniqid(),
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 50.00 * $quantity,
            'currency' => 'ETB',
            'status' => 'paid',
        ]);

        for ($i = 0; $i < $quantity; $i++) {
            Ticket::create([
                'booking_id' => $booking->id,
                'ticket_identifier' => 'TKT-' . uniqid(),
                'ticket_token' => 'TOK-' . uniqid(),
                'seat_number' => $i + 1,
                'status' => 'active',
            ]);
        }

        return $booking;
    }

    public function test_can_request_refund_for_eligible_booking()
    {
        $event = $this->createEvent(daysAway: 10, availableTickets: 98);
        $booking = $this->createPaidBooking($event);

        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund", [
            'reason' => 'Changed my mind'
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('refund_requests', [
            'booking_id' => $booking->id,
            'status' => 'requested',
            'reason' => 'Changed my mind'
        ]);

        // Booking should be cancelled
        $this->assertEquals('cancelled', $booking->fresh()->booking_status);
        
        // Tickets should be cancelled
        $this->assertDatabaseMissing('tickets', [
            'booking_id' => $booking->id,
            'status' => 'active'
        ]);
        
        // Inventory restored
        $this->assertEquals(100, $event->fresh()->available_tickets);
    }

    public function test_cannot_request_refund_if_event_is_too_close()
    {
        config(['refunds.cutoff_hours_before_event' => 24]);
        
        // Event is only 12 hours away
        $event = Event::create([
            'title' => 'Test',
            'category' => 'Music',
            'location' => 'Loc',
            'event_date' => Carbon::now()->addHours(12),
            'ticket_price' => 50.00,
            'total_tickets' => 100,
            'available_tickets' => 98,
            'status' => 'active',
            'organizer_id' => $this->organizer->id,
        ]);
        
        $booking = $this->createPaidBooking($event);

        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund");

        $response->assertStatus(422);
        $response->assertJsonFragment(['message' => 'Cancellations must be made at least 24 hours before the event starts.']);
    }

    public function test_cannot_request_refund_if_ticket_used()
    {
        $event = $this->createEvent();
        $booking = $this->createPaidBooking($event);

        // Mark a ticket as used
        $booking->tickets()->first()->update(['status' => 'used']);

        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund");

        $response->assertStatus(422);
        $response->assertJsonFragment(['message' => 'Tickets have already been used for check-in. Cannot process refund.']);
    }

    public function test_cannot_request_refund_twice()
    {
        $event = $this->createEvent();
        $booking = $this->createPaidBooking($event);

        // First request should succeed
        $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund")->assertStatus(200);

        // Second request should fail
        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund");
        
        $response->assertStatus(422);
        $response->assertJsonFragment(['message' => 'This booking is already cancelled.']);
    }

    public function test_cannot_request_refund_for_unpaid_booking()
    {
        $event = $this->createEvent();
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $event->id,
            'ticket_quantity' => 1,
            'total_price' => 50.00,
            'booking_status' => 'pending',
            'payment_status' => 'pending',
            'payment_method' => 'telebirr',
            'expires_at' => Carbon::now()->addMinutes(15),
        ]);

        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund");

        $response->assertStatus(422);
        $response->assertJsonFragment(['message' => 'Only paid bookings can be refunded.']);
    }
}
