<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizerEventTest extends TestCase
{
    use RefreshDatabase;

    private User $organizer;
    private User $customer;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->organizer = User::factory()->create(['role' => 'organizer', 'name' => 'Abebe Organizer', 'email' => 'organizer@test.com']);
        $this->customer = User::factory()->create(['role' => 'customer', 'name' => 'John Customer', 'email' => 'customer@test.com']);
        $this->superAdmin = User::factory()->create(['role' => 'super-admin', 'name' => 'Super Admin', 'email' => 'admin@test.com']);
    }

    public function test_unauthenticated_user_cannot_create_event(): void
    {
        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(5)->toIso8601String(),
            'ticket_price' => 150.00,
            'total_tickets' => 200,
            'status' => 'draft',
        ]);

        $response->assertStatus(401);
    }

    public function test_customer_cannot_create_event(): void
    {
        Sanctum::actingAs($this->customer);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Customer Attempt Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(5)->toIso8601String(),
            'ticket_price' => 150.00,
            'total_tickets' => 200,
            'status' => 'draft',
        ]);

        $response->assertStatus(403);
    }

    public function test_organizer_can_create_event_without_image(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Addis Tech Summit 2026',
            'category' => 'Technology',
            'description' => 'The leading tech conference in East Africa.',
            'location' => 'Millennium Hall, Addis Ababa',
            'event_date' => now()->addDays(30)->format('Y-m-d H:i:s'),
            'ticket_price' => 500.00,
            'total_tickets' => 1000,
            'status' => 'active',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'message',
            'event' => [
                'id',
                'title',
                'category',
                'description',
                'location',
                'event_date',
                'ticket_price',
                'total_tickets',
                'available_tickets',
                'status',
                'organizer_id',
            ],
        ]);

        $this->assertDatabaseHas('events', [
            'title' => 'Addis Tech Summit 2026',
            'organizer_id' => $this->organizer->id,
            'available_tickets' => 1000,
            'status' => 'active',
        ]);
    }

    public function test_organizer_can_create_free_draft_event(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Free Community Workshop',
            'category' => 'Community',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(14)->format('Y-m-d H:i:s'),
            'ticket_price' => 0,
            'total_tickets' => 50,
            'status' => 'draft',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('events', [
            'title' => 'Free Community Workshop',
            'ticket_price' => 0,
            'status' => 'draft',
        ]);
    }

    public function test_organizer_can_create_event_with_image_upload(): void
    {
        Sanctum::actingAs($this->organizer);

        $image = UploadedFile::fake()->image('banner.png', 1200, 600)->size(1500);

        $response = $this->post('/api/organizer/events', [
            'title' => 'Visual Arts Exhibition',
            'category' => 'Arts',
            'location' => 'National Museum',
            'event_date' => now()->addDays(20)->format('Y-m-d H:i:s'),
            'ticket_price' => 250.00,
            'total_tickets' => 300,
            'status' => 'active',
            'image' => $image,
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertStatus(201);
        $event = Event::where('title', 'Visual Arts Exhibition')->first();
        $this->assertNotNull($event);
        $this->assertNotNull($event->image_url);
        $this->assertStringStartsWith('/storage/events/', $event->image_url);
    }

    public function test_event_creation_validates_required_fields(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/organizer/events', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors([
            'title',
            'category',
            'location',
            'event_date',
            'ticket_price',
            'total_tickets',
            'status',
        ]);
    }

    public function test_event_creation_rejects_past_date(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Past Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->subDay()->format('Y-m-d H:i:s'),
            'ticket_price' => 100,
            'total_tickets' => 100,
            'status' => 'draft',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['event_date']);
    }

    public function test_event_creation_rejects_negative_price(): void
    {
        Sanctum::actingAs($this->organizer);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Negative Price Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(5)->format('Y-m-d H:i:s'),
            'ticket_price' => -50,
            'total_tickets' => 100,
            'status' => 'draft',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['ticket_price']);
    }

    public function test_super_admin_can_create_event(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'National Gala',
            'category' => 'Business',
            'location' => 'Sheraton Addis',
            'event_date' => now()->addDays(60)->format('Y-m-d H:i:s'),
            'ticket_price' => 1500.00,
            'total_tickets' => 500,
            'status' => 'active',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('events', [
            'title' => 'National Gala',
            'organizer_id' => $this->superAdmin->id,
        ]);
    }
}
