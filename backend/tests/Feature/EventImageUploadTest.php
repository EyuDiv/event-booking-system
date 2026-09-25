<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EventImageUploadTest extends TestCase
{
    use RefreshDatabase;

    private User $organizer;
    private User $otherOrganizer;
    private User $customer;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->organizer = User::factory()->create(['role' => 'organizer']);
        $this->otherOrganizer = User::factory()->create(['role' => 'organizer']);
        $this->customer = User::factory()->create(['role' => 'customer']);
        $this->superAdmin = User::factory()->create(['role' => 'super-admin']);
    }

    public function test_organizer_can_create_event_with_valid_image()
    {
        Sanctum::actingAs($this->organizer);

        $image = UploadedFile::fake()->image('cover.jpg', 800, 600)->size(1024);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'status' => 'draft',
            'image' => $image,
        ]);

        $response->assertStatus(201);
        
        $event = Event::first();
        $this->assertNotNull($event->image_url);
        $this->assertStringStartsWith('/storage/events/', $event->image_url);

        // Verify the file was stored on the disk
        $path = str_replace('/storage/', '', $event->image_url);
        Storage::disk('public')->assertExists($path);
    }

    public function test_invalid_image_type_is_rejected()
    {
        Sanctum::actingAs($this->organizer);

        $document = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'status' => 'draft',
            'image' => $document,
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['image']);
    }

    public function test_oversized_image_is_rejected()
    {
        Sanctum::actingAs($this->organizer);

        // 3MB image (limit is 2048 KB)
        $image = UploadedFile::fake()->image('huge.jpg')->size(3000);

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'status' => 'draft',
            'image' => $image,
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors(['image']);
    }

    public function test_customer_cannot_upload_event_image()
    {
        Sanctum::actingAs($this->customer);

        $image = UploadedFile::fake()->image('cover.jpg');

        $response = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'status' => 'draft',
            'image' => $image,
        ]);

        $response->assertStatus(403);
    }

    public function test_organizer_cannot_modify_other_organizers_event_image()
    {
        // Organizer 1 creates an event
        $event = Event::create([
            'title' => 'Title',
            'category' => 'Music',
            'location' => 'Loc',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'available_tickets' => 500,
            'status' => 'draft',
            'organizer_id' => $this->organizer->id,
            'image_url' => '/storage/events/original.jpg',
        ]);

        // Organizer 2 tries to update it
        Sanctum::actingAs($this->otherOrganizer);
        $newImage = UploadedFile::fake()->image('new.jpg');

        $response = $this->putJson("/api/organizer/events/{$event->id}", [
            'image' => $newImage,
        ]);

        $response->assertStatus(403);
    }

    public function test_replacing_image_removes_old_file()
    {
        Sanctum::actingAs($this->organizer);

        // Upload first image
        $image1 = UploadedFile::fake()->image('first.jpg');
        $response1 = $this->postJson('/api/organizer/events', [
            'title' => 'Test Event',
            'category' => 'Music',
            'location' => 'Addis Ababa',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'status' => 'draft',
            'image' => $image1,
        ]);
        
        $eventId = $response1->json('event.id');
        $imageUrl1 = $response1->json('event.image_url');
        $path1 = str_replace('/storage/', '', $imageUrl1);
        
        Storage::disk('public')->assertExists($path1);

        // Upload second image
        $image2 = UploadedFile::fake()->image('second.png');
        $response2 = $this->putJson("/api/organizer/events/{$eventId}", [
            'image' => $image2,
        ]);

        $response2->assertStatus(200);
        $imageUrl2 = $response2->json('event.image_url');
        $path2 = str_replace('/storage/', '', $imageUrl2);

        $this->assertNotEquals($imageUrl1, $imageUrl2);
        
        // Old image should be deleted
        Storage::disk('public')->assertMissing($path1);
        // New image should exist
        Storage::disk('public')->assertExists($path2);
    }

    public function test_super_admin_can_modify_event_image()
    {
        $event = Event::create([
            'title' => 'Title',
            'category' => 'Music',
            'location' => 'Loc',
            'event_date' => now()->addDays(10)->toDateTimeString(),
            'ticket_price' => 100,
            'total_tickets' => 500,
            'available_tickets' => 500,
            'status' => 'draft',
            'organizer_id' => $this->organizer->id,
        ]);

        Sanctum::actingAs($this->superAdmin);
        $newImage = UploadedFile::fake()->image('admin_cover.png');

        $response = $this->putJson("/api/organizer/events/{$event->id}", [
            'image' => $newImage,
        ]);

        $response->assertStatus(200);
        $this->assertNotNull($response->json('event.image_url'));
    }
}
