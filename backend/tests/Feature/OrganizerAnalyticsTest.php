<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Carbon\Carbon;

class OrganizerAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $organizer;
    private User $customer;
    private User $otherOrganizer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizer = User::factory()->create(['role' => 'organizer']);
        $this->otherOrganizer = User::factory()->create(['role' => 'organizer']);
        $this->customer = User::factory()->create(['role' => 'customer']);
    }

    private function createEvent(array $attributes = []): Event
    {
        return Event::create(array_merge([
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Test Location',
            'event_date' => Carbon::now()->addDays(10),
            'ticket_price' => 50.00,
            'total_tickets' => 100,
            'available_tickets' => 100,
            'status' => 'active',
            'organizer_id' => $this->organizer->id,
        ], $attributes));
    }

    private function createBooking(array $attributes = []): Booking
    {
        return Booking::create(array_merge([
            'user_id' => $this->customer->id,
            'event_id' => 1,
            'ticket_quantity' => 1,
            'total_price' => 50.00,
            'booking_status' => 'pending',
            'payment_status' => 'pending',
            'payment_method' => 'telebirr',
            'expires_at' => Carbon::now()->addMinutes(15),
        ], $attributes));
    }

    public function test_unauthenticated_users_cannot_access_analytics()
    {
        $response = $this->getJson('/api/organizer/analytics');
        $response->assertStatus(401);
    }

    public function test_customers_cannot_access_analytics()
    {
        $response = $this->actingAs($this->customer)->getJson('/api/organizer/analytics');
        $response->assertStatus(403);
    }

    public function test_organizer_can_view_own_analytics()
    {
        // Organizer's event
        $event = $this->createEvent([
            'available_tickets' => 98
        ]);

        // Confirmed booking with paid payment
        $booking = $this->createBooking([
            'event_id' => $event->id,
            'booking_status' => 'confirmed',
            'payment_status' => 'paid',
            'ticket_quantity' => 2,
            'total_price' => 100,
        ]);
        Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'TEST-REF-1',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 100,
            'currency' => 'ETB',
            'status' => 'paid',
        ]);
        Ticket::create([
            'booking_id' => $booking->id,
            'ticket_identifier' => 'T-1',
            'ticket_token' => 'TOK-1',
            'seat_number' => 1,
            'status' => 'used',
        ]);
        Ticket::create([
            'booking_id' => $booking->id,
            'ticket_identifier' => 'T-2',
            'ticket_token' => 'TOK-2',
            'seat_number' => 2,
            'status' => 'used',
        ]);

        // Pending booking with pending payment
        $pendingBooking = $this->createBooking([
            'event_id' => $event->id,
            'booking_status' => 'pending',
            'payment_status' => 'pending',
            'ticket_quantity' => 1,
            'total_price' => 50,
        ]);
        Payment::create([
            'booking_id' => $pendingBooking->id,
            'reference' => 'TEST-REF-2',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 50,
            'currency' => 'ETB',
            'status' => 'pending',
        ]);

        // Other organizer's event
        $otherEvent = $this->createEvent([
            'organizer_id' => $this->otherOrganizer->id,
        ]);
        $otherBooking = $this->createBooking([
            'event_id' => $otherEvent->id,
            'booking_status' => 'confirmed',
            'payment_status' => 'paid',
            'total_price' => 200,
        ]);
        Payment::create([
            'booking_id' => $otherBooking->id,
            'reference' => 'TEST-REF-3',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 200,
            'currency' => 'ETB',
            'status' => 'paid',
        ]);

        // Call the endpoint
        $response = $this->actingAs($this->organizer)->getJson('/api/organizer/analytics');
        $response->assertStatus(200);

        $json = $response->json();
        
        $this->assertArrayHasKey('overall', $json);
        $this->assertArrayHasKey('events', $json);

        $overall = $json['overall'];
        
        $this->assertEquals(1, $overall['total_events']);
        $this->assertEquals(1, $overall['active_events']);
        $this->assertEquals(2, $overall['total_bookings']);
        $this->assertEquals(1, $overall['confirmed_bookings']);
        $this->assertEquals(1, $overall['pending_bookings']);
        $this->assertEquals(100, $overall['total_tickets_available']);
        $this->assertEquals(2, $overall['total_tickets_sold']);
        $this->assertEquals(2, $overall['checked_in_tickets']);
        $this->assertEquals(100, $overall['total_revenue']);
        
        $this->assertCount(1, $json['events']);
        $this->assertEquals($event->id, $json['events'][0]['id']);
        $this->assertEquals(100, $json['events'][0]['revenue']);
        $this->assertEquals(2, $json['events'][0]['checked_in_tickets_count']);
    }

    public function test_organizer_can_view_specific_event_analytics()
    {
        $event = $this->createEvent();

        $booking = $this->createBooking([
            'event_id' => $event->id,
            'booking_status' => 'confirmed',
            'payment_status' => 'paid',
            'total_price' => 150,
        ]);
        Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'TEST-REF-4',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 150,
            'currency' => 'ETB',
            'status' => 'paid',
        ]);
        Ticket::create([
            'booking_id' => $booking->id,
            'ticket_identifier' => 'T-3',
            'ticket_token' => 'TOK-3',
            'seat_number' => 3,
            'status' => 'used',
        ]);

        $response = $this->actingAs($this->organizer)->getJson("/api/organizer/events/{$event->id}/analytics");
        $response->assertStatus(200);

        $json = $response->json('event');
        $this->assertEquals($event->id, $json['id']);
        $this->assertEquals(1, $json['confirmed_bookings_count']);
        $this->assertEquals(150, $json['revenue']);
        $this->assertEquals(1, $json['checked_in_tickets_count']);
    }

    public function test_organizer_cannot_view_other_organizers_event_analytics()
    {
        $otherEvent = $this->createEvent([
            'organizer_id' => $this->otherOrganizer->id,
        ]);

        $response = $this->actingAs($this->organizer)->getJson("/api/organizer/events/{$otherEvent->id}/analytics");
        $response->assertStatus(404);
    }
}
