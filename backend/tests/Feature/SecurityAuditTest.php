<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class SecurityAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $customer;
    protected User $organizer;
    protected User $otherOrganizer;
    protected User $otherCustomer;
    protected Event $event;
    protected Booking $booking;
    protected Ticket $ticket;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::factory()->create(['role' => 'customer']);
        $this->otherCustomer = User::factory()->create(['role' => 'customer']);
        $this->organizer = User::factory()->create(['role' => 'organizer']);
        $this->otherOrganizer = User::factory()->create(['role' => 'organizer']);

        $this->event = Event::create([
            'organizer_id'      => $this->organizer->id,
            'title'             => 'Security Test Event',
            'category'          => 'Security',
            'location'          => 'Test Lab',
            'event_date'        => now()->addDays(5),
            'ticket_price'      => 100.00,
            'total_tickets'     => 10,
            'available_tickets' => 10,
            'status'            => 'active',
        ]);

        $this->booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 1,
            'total_price'     => 100.00,
            'booking_status'  => Booking::BOOKING_CONFIRMED,
            'payment_status'  => Booking::PAYMENT_PAID,
            'payment_method'  => 'cash',
        ]);

        $this->ticket = Ticket::create([
            'booking_id'        => $this->booking->id,
            'ticket_identifier' => 'TKT-TEST1',
            'ticket_token'      => 'secret-qr-token',
            'status'            => Ticket::STATUS_ACTIVE,
        ]);
    }

    public function test_idor_ticket_validation_rejected_for_customer()
    {
        // Customer tries to validate a ticket (even their own)
        $response = $this->actingAs($this->customer)->getJson("/api/tickets/{$this->ticket->ticket_token}/validate");
        $response->assertStatus(403);
    }

    public function test_idor_ticket_checkin_rejected_for_unrelated_organizer()
    {
        // Another organizer tries to check in a ticket for an event they don't own
        $response = $this->actingAs($this->otherOrganizer)->postJson("/api/tickets/{$this->ticket->ticket_token}/checkin");
        $response->assertStatus(403);
    }

    public function test_ticket_checkin_allowed_for_event_owner()
    {
        // The actual organizer should be allowed
        $response = $this->actingAs($this->organizer)->postJson("/api/tickets/{$this->ticket->ticket_token}/checkin");
        $response->assertStatus(200);
        $this->assertEquals(Ticket::STATUS_USED, $this->ticket->fresh()->status);
    }

    public function test_mass_assignment_protection_on_event_update()
    {
        // The organizer tries to change the organizer_id via update (which shouldn't be allowed)
        $response = $this->actingAs($this->organizer)->putJson("/api/organizer/events/{$this->event->id}", [
            'organizer_id' => $this->otherOrganizer->id,
            'title'        => 'Updated Title',
        ]);

        $response->assertStatus(200);
        // The title should be updated, but organizer_id remains the same
        $this->assertEquals('Updated Title', $this->event->fresh()->title);
        $this->assertEquals($this->organizer->id, $this->event->fresh()->organizer_id);
    }

    public function test_auth_rate_limiting()
    {
        // Clear all cache to reset rate limiters
        app('cache')->flush();

        // Allow 6 attempts
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/login', [
                'email'    => 'invalid@example.com',
                'password' => 'wrong',
            ])->assertStatus(401); // Standard auth failure
        }

        // 7th attempt should be rate limited
        $this->postJson('/api/login', [
            'email'    => 'invalid@example.com',
            'password' => 'wrong',
        ])->assertStatus(429); // Too Many Requests
    }
}
