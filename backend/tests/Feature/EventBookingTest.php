<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventBookingTest extends TestCase
{
    use RefreshDatabase;

    protected User $customer;
    protected User $organizer;
    protected Event $activeEvent;
    protected Event $soldOutEvent;
    protected Event $draftEvent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizer = User::firstOrCreate(
            ['email' => 'organizer_test@tikethub.com'],
            ['name' => 'Test Organizer', 'password' => Hash::make('password123'), 'role' => 'organizer']
        );

        $this->customer = User::firstOrCreate(
            ['email' => 'customer_test@tikethub.com'],
            ['name' => 'Test Customer', 'password' => Hash::make('password123'), 'role' => 'customer']
        );

        $this->activeEvent = Event::create([
            'title'             => 'Feature Test Concert',
            'category'          => 'Music',
            'description'       => 'High-fidelity acoustic festival test.',
            'location'          => 'National Theatre Addis Ababa',
            'event_date'        => now()->addDays(7),
            'ticket_price'      => 500.00,
            'total_tickets'     => 10,
            'available_tickets' => 10,
            'status'            => 'active',
            'image_url'         => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
            'organizer_id'      => $this->organizer->id,
            'created_at'        => now(),
        ]);

        $this->soldOutEvent = Event::create([
            'title'             => 'Sold Out Gala',
            'category'          => 'Cultural',
            'description'       => 'Sold out test event.',
            'location'          => 'Millennium Hall',
            'event_date'        => now()->addDays(14),
            'ticket_price'      => 300.00,
            'total_tickets'     => 5,
            'available_tickets' => 0,
            'status'            => 'sold_out',
            'organizer_id'      => $this->organizer->id,
            'created_at'        => now(),
        ]);

        $this->draftEvent = Event::create([
            'title'             => 'Draft Internal Event',
            'category'          => 'Technology',
            'description'       => 'Secret draft test.',
            'location'          => 'Conference Room A',
            'event_date'        => now()->addDays(20),
            'ticket_price'      => 100.00,
            'total_tickets'     => 20,
            'available_tickets' => 20,
            'status'            => 'draft',
            'organizer_id'      => $this->organizer->id,
            'created_at'        => now(),
        ]);
    }

    public function test_can_fetch_public_event_details(): void
    {
        $response = $this->getJson("/api/events/{$this->activeEvent->id}");

        $response->assertStatus(200)
            ->assertJsonPath('event.id', $this->activeEvent->id)
            ->assertJsonPath('event.title', 'Feature Test Concert')
            ->assertJsonPath('event.ticket_price', '500.00')
            ->assertJsonPath('event.available_tickets', 10);
    }

    public function test_returns_404_for_non_existent_event(): void
    {
        $response = $this->getJson('/api/events/99999999');

        $response->assertStatus(404);
    }

    public function test_returns_404_for_draft_event(): void
    {
        $response = $this->getJson("/api/events/{$this->draftEvent->id}");

        $response->assertStatus(404);
    }

    public function test_unauthenticated_user_cannot_book(): void
    {
        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => 2,
            'payment_method'  => 'telebirr',
        ]);

        $response->assertStatus(401);
    }

    public function test_non_customer_role_cannot_book(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => 2,
            'payment_method'  => 'telebirr',
        ]);

        $response->assertStatus(403);
    }

    public function test_cannot_book_zero_or_negative_quantity(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => 0,
            'payment_method'  => 'telebirr',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['ticket_quantity']);
    }

    public function test_cannot_book_sold_out_event(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->soldOutEvent->id,
            'ticket_quantity' => 1,
            'payment_method'  => 'telebirr',
        ]);

        $response->assertStatus(422);
    }

    public function test_prevents_overbooking_when_requested_exceeds_available(): void
    {
        Sanctum::actingAs($this->customer);

        // Active event has 10 tickets, request 11
        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => 11,
            'payment_method'  => 'telebirr',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['ticket_quantity']);

        // Verify available_tickets did not change
        $this->activeEvent->refresh();
        $this->assertEquals(10, $this->activeEvent->available_tickets);
    }

    public function test_validates_payment_method(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => 1,
            'payment_method'  => 'fake_crypto_gateway',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }

    public function test_successful_booking_creates_mysql_record_and_decrements_inventory(): void
    {
        Sanctum::actingAs($this->customer);

        $quantity = 3;
        $unitPrice = 500.00;
        $expectedTotal = '1500.00';

        $initialTickets = $this->activeEvent->available_tickets;

        $response = $this->postJson('/api/bookings', [
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => $quantity,
            'payment_method'  => 'telebirr',
            'total_price'     => 1.00, // Client tries to spoof total price: must be ignored by backend!
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('booking.ticket_quantity', $quantity)
            ->assertJsonPath('booking.total_price', $expectedTotal)
            ->assertJsonPath('booking.booking_status', 'pending')
            ->assertJsonPath('booking.payment_status', 'pending')
            ->assertJsonPath('booking.payment_method', 'telebirr')
            ->assertJsonPath('booking.user_id', $this->customer->id);

        // Verify database state directly
        $this->activeEvent->refresh();
        $this->assertEquals($initialTickets - $quantity, $this->activeEvent->available_tickets);

        $this->assertDatabaseHas('bookings', [
            'user_id'         => $this->customer->id,
            'event_id'        => $this->activeEvent->id,
            'ticket_quantity' => $quantity,
            'total_price'     => $expectedTotal,
            'booking_status'  => 'pending',
            'payment_status'  => 'pending',
            'payment_method'  => 'telebirr',
        ]);
    }
}
