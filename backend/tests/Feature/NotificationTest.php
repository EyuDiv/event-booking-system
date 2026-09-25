<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Event;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $organizer;
    private Event $event;
    private Booking $booking;
    private Payment $payment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::create([
            'name' => 'Test Customer',
            'email' => 'cust@example.com',
            'password' => 'secret',
            'role' => 'customer'
        ]);

        $this->organizer = User::create([
            'name' => 'Test Organizer',
            'email' => 'org@example.com',
            'password' => 'secret',
            'role' => 'organizer'
        ]);

        $this->event = Event::create([
            'organizer_id'      => $this->organizer->id,
            'title'             => 'Test Event',
            'description'       => 'Test',
            'event_date'        => now()->addDays(5),
            'location'          => 'Addis Ababa',
            'category'          => 'Tech',
            'ticket_price'      => 100,
            'total_tickets'     => 100,
            'available_tickets' => 100,
            'status'            => 'active',
        ]);

        $this->booking = Booking::create([
            'user_id'         => $this->customer->id,
            'event_id'        => $this->event->id,
            'ticket_quantity' => 2,
            'total_price'     => 200,
            'booking_status'  => Booking::BOOKING_PENDING,
            'payment_status'  => Booking::PAYMENT_PENDING,
            'payment_method'  => 'telebirr',
            'reference'       => 'TEST-BOOKING'
        ]);

        $this->payment = Payment::create([
            'booking_id' => $this->booking->id,
            'amount'         => 200,
            'status'         => Payment::STATUS_PENDING,
            'provider'       => 'telebirr',
            'payment_method' => 'telebirr',
            'reference'      => 'PAY-123'
        ]);
    }

    public function test_api_endpoints_are_protected()
    {
        $this->getJson('/api/notifications')->assertStatus(401);
        $this->getJson('/api/notifications/unread-count')->assertStatus(401);
    }

    public function test_unread_count_and_listing()
    {
        $service = app(\App\Services\NotificationService::class);
        $service->notifyBookingConfirmed($this->booking);

        $this->actingAs($this->customer);

        $this->getJson('/api/notifications/unread-count')
            ->assertStatus(200)
            ->assertJson(['count' => 1]);

        $response = $this->getJson('/api/notifications')
            ->assertStatus(200);

        $this->assertCount(1, $response->json('notifications.data'));
        $this->assertEquals('BOOKING_CONFIRMED', $response->json('notifications.data.0.type'));
    }

    public function test_mark_as_read()
    {
        $service = app(\App\Services\NotificationService::class);
        $service->notifyBookingConfirmed($this->booking);

        $this->actingAs($this->customer);

        $id = $this->customer->notifications()->first()->id;

        $this->postJson("/api/notifications/{$id}/read")
            ->assertStatus(200);

        $this->getJson('/api/notifications/unread-count')
            ->assertStatus(200)
            ->assertJson(['count' => 0]);
    }

    public function test_mark_all_as_read()
    {
        $service = app(\App\Services\NotificationService::class);
        $service->notifyBookingConfirmed($this->booking);
        $service->notifyPaymentSuccessful($this->payment);

        $this->actingAs($this->customer);
        
        $this->assertEquals(2, $this->customer->unreadNotifications()->count());

        $this->postJson("/api/notifications/read-all")
            ->assertStatus(200);

        $this->assertEquals(0, $this->customer->unreadNotifications()->count());
    }

    public function test_idempotency_prevents_duplicate_notifications()
    {
        $service = app(\App\Services\NotificationService::class);
        
        $service->notifyBookingConfirmed($this->booking);
        $service->notifyBookingConfirmed($this->booking);
        
        $this->assertEquals(1, $this->customer->notifications()->count());
    }
}
