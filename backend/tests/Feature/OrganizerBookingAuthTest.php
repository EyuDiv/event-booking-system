<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * OrganizerBookingAuthTest
 *
 * Verifies authorization rules for GET /api/organizer/events/{event}/bookings:
 *
 *  1. Unauthenticated → 401
 *  2. Customer role → 403
 *  3. Organizer accessing another organizer's event → 403
 *  4. Organizer accessing own event → 200 with correct data
 *  5. Super-admin accessing any event → 200
 *  6. Event not found → 404
 *  7. Sensitive fields (ticket_token, password) are never exposed
 *  8. Filters work (booking_status, payment_status, search)
 *  9. Pagination meta is present
 * 10. Stats block is correct
 */
class OrganizerBookingAuthTest extends TestCase
{
    use RefreshDatabase;

    private User $organizerA;
    private User $organizerB;
    private User $customer;
    private User $superAdmin;
    private Event $eventA;  // owned by organizerA
    private Event $eventB;  // owned by organizerB
    private Booking $bookingA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizerA = User::factory()->create(['role' => 'organizer', 'name' => 'Organizer Alpha', 'email' => 'alpha@test.com']);
        $this->organizerB = User::factory()->create(['role' => 'organizer', 'name' => 'Organizer Beta',  'email' => 'beta@test.com']);
        $this->customer   = User::factory()->create(['role' => 'customer',  'name' => 'John Customer',   'email' => 'john@test.com']);
        $this->superAdmin = User::factory()->create(['role' => 'super-admin', 'name' => 'Super Admin',   'email' => 'admin@test.com']);

        // Event owned by organizerA
        $this->eventA = Event::create([
            'title'             => 'Alpha Music Fest',
            'category'          => 'Music',
            'description'       => 'Test event A',
            'location'          => 'Addis Ababa',
            'event_date'        => now()->addDays(10),
            'ticket_price'      => 500.00,
            'total_tickets'     => 50,
            'available_tickets' => 45,
            'status'            => 'active',
            'image_url'         => null,
            'organizer_id'      => $this->organizerA->id,
            'created_at'        => now(),
        ]);

        // Event owned by organizerB
        $this->eventB = Event::create([
            'title'             => 'Beta Tech Summit',
            'category'          => 'Technology',
            'description'       => 'Test event B',
            'location'          => 'Bole',
            'event_date'        => now()->addDays(20),
            'ticket_price'      => 200.00,
            'total_tickets'     => 100,
            'available_tickets' => 100,
            'status'            => 'active',
            'image_url'         => null,
            'organizer_id'      => $this->organizerB->id,
            'created_at'        => now(),
        ]);

        // A confirmed paid booking on eventA from the customer
        $this->bookingA = Booking::create([
            'user_id'        => $this->customer->id,
            'event_id'       => $this->eventA->id,
            'ticket_quantity' => 2,
            'total_price'    => 1000.00,
            'booking_status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'telebirr',
            'expires_at'     => now()->addHours(1),
            'created_at'     => now(),
        ]);

        // Payment for bookingA
        Payment::create([
            'booking_id'     => $this->bookingA->id,
            'reference'      => 'PAY-TEST-001',
            'provider'       => 'telebirr',
            'payment_method' => 'telebirr',
            'amount'         => 1000.00,
            'currency'       => 'ETB',
            'status'         => 'paid',
            'paid_at'        => now(),
            'failed_at'      => null,
            'provider_reference' => 'TELE-REF-001',
        ]);

        // Tickets for bookingA
        Ticket::create([
            'booking_id'        => $this->bookingA->id,
            'ticket_identifier' => 'TKT-001',
            'ticket_token'      => 'secret-token-should-not-appear',
            'seat_number'       => 1,
            'status'            => 'used',
            'checked_in_at'     => now(),
        ]);
        Ticket::create([
            'booking_id'        => $this->bookingA->id,
            'ticket_identifier' => 'TKT-002',
            'ticket_token'      => 'another-secret-token',
            'seat_number'       => 2,
            'status'            => 'active',
            'checked_in_at'     => null,
        ]);
    }

    // ─── Authorization tests ──────────────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");
        $response->assertStatus(401);
    }

    public function test_customer_role_cannot_access_organizer_bookings(): void
    {
        Sanctum::actingAs($this->customer);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");
        $response->assertStatus(403);
    }

    public function test_organizer_cannot_access_another_organizers_event_bookings(): void
    {
        Sanctum::actingAs($this->organizerB);
        // organizerB tries to access eventA (owned by organizerA)
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");
        $response->assertStatus(403);
    }

    public function test_organizer_can_access_own_event_bookings(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200)
            ->assertJsonPath('event.id', $this->eventA->id)
            ->assertJsonPath('event.title', 'Alpha Music Fest')
            ->assertJsonStructure([
                'event'    => ['id', 'title', 'location', 'event_date', 'total_tickets', 'available_tickets'],
                'stats'    => ['total_bookings', 'tickets_sold', 'confirmed_bookings', 'checked_in_count'],
                'bookings' => [['id', 'ticket_quantity', 'total_price', 'booking_status', 'payment_status',
                                'customer' => ['id', 'name', 'email'],
                                'tickets']],
                'pagination' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);
    }

    public function test_super_admin_can_access_any_event_bookings(): void
    {
        Sanctum::actingAs($this->superAdmin);

        // Super-admin accesses eventA (not theirs)
        $responseA = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");
        $responseA->assertStatus(200);

        // Super-admin accesses eventB
        $responseB = $this->getJson("/api/organizer/events/{$this->eventB->id}/bookings");
        $responseB->assertStatus(200);
    }

    public function test_returns_404_for_nonexistent_event(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson('/api/organizer/events/999999/bookings');
        $response->assertStatus(404);
    }

    // ─── Security: sensitive fields never exposed ─────────────────────────────

    public function test_ticket_token_is_never_exposed_in_organizer_bookings(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200);
        $content = $response->getContent();

        $this->assertStringNotContainsString('ticket_token', $content);
        $this->assertStringNotContainsString('secret-token-should-not-appear', $content);
        $this->assertStringNotContainsString('another-secret-token', $content);
    }

    public function test_customer_password_is_never_exposed(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200);
        $content = $response->getContent();
        $this->assertStringNotContainsString('password', $content);
    }

    public function test_payment_provider_metadata_is_never_exposed(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200);
        $content = $response->getContent();
        $this->assertStringNotContainsString('provider_metadata', $content);
        $this->assertStringNotContainsString('provider_reference', $content);
    }

    // ─── Data correctness ─────────────────────────────────────────────────────

    public function test_booking_data_is_correct(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200)
            ->assertJsonPath('bookings.0.id', $this->bookingA->id)
            ->assertJsonPath('bookings.0.ticket_quantity', 2)
            ->assertJsonPath('bookings.0.booking_status', 'confirmed')
            ->assertJsonPath('bookings.0.payment_status', 'paid')
            ->assertJsonPath('bookings.0.customer.name', 'John Customer')
            ->assertJsonPath('bookings.0.customer.email', 'john@test.com')
            ->assertJsonPath('bookings.0.payment.reference', 'PAY-TEST-001')
            ->assertJsonPath('bookings.0.payment.status', 'paid');

        // Verify total_price is numeric 1000
        $totalPrice = $response->json('bookings.0.total_price');
        $this->assertEquals(1000, (int) $totalPrice);
    }

    public function test_tickets_checkin_status_is_returned(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200);
        $tickets = $response->json('bookings.0.tickets');
        $this->assertCount(2, $tickets);

        $used = collect($tickets)->firstWhere('status', 'used');
        $this->assertNotNull($used);
        $this->assertNotNull($used['checked_in_at']);

        $active = collect($tickets)->firstWhere('status', 'active');
        $this->assertNotNull($active);
        $this->assertNull($active['checked_in_at']);
    }

    public function test_stats_block_is_correct(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings");

        $response->assertStatus(200)
            ->assertJsonPath('stats.total_bookings', 1)
            ->assertJsonPath('stats.confirmed_bookings', 1)
            ->assertJsonPath('stats.checked_in_count', 1);
    }

    // ─── Filter tests ─────────────────────────────────────────────────────────

    public function test_filter_by_booking_status_returns_matching_bookings(): void
    {
        Sanctum::actingAs($this->organizerA);

        // Filter for confirmed — should return 1
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?booking_status=confirmed");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 1);

        // Filter for pending — should return 0
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?booking_status=pending");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 0);
    }

    public function test_filter_by_payment_status_returns_matching_bookings(): void
    {
        Sanctum::actingAs($this->organizerA);

        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?payment_status=paid");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 1);

        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?payment_status=failed");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 0);
    }

    public function test_search_by_customer_name_works(): void
    {
        Sanctum::actingAs($this->organizerA);

        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?search=John");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 1);

        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?search=nobody");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 0);
    }

    public function test_search_by_customer_email_works(): void
    {
        Sanctum::actingAs($this->organizerA);

        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?search=john@test");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 1);
    }

    public function test_filter_by_ticket_status_works(): void
    {
        Sanctum::actingAs($this->organizerA);

        // Has 'used' tickets → should return booking
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?ticket_status=used");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 1);

        // No 'cancelled' tickets → should return 0
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?ticket_status=cancelled");
        $response->assertStatus(200)->assertJsonPath('pagination.total', 0);
    }

    public function test_pagination_meta_is_returned(): void
    {
        Sanctum::actingAs($this->organizerA);
        $response = $this->getJson("/api/organizer/events/{$this->eventA->id}/bookings?per_page=10");

        $response->assertStatus(200)
            ->assertJsonStructure(['pagination' => ['current_page', 'last_page', 'per_page', 'total', 'from', 'to']]);
    }

    public function test_eventB_has_no_bookings_for_organizer_b(): void
    {
        Sanctum::actingAs($this->organizerB);
        $response = $this->getJson("/api/organizer/events/{$this->eventB->id}/bookings");

        $response->assertStatus(200)->assertJsonPath('pagination.total', 0);
    }
}
