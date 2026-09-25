<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $organizer;
    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->superAdmin = User::factory()->create([
            'role' => 'super-admin'
        ]);

        $this->organizer = User::factory()->create([
            'role' => 'organizer'
        ]);

        $this->customer = User::factory()->create([
            'role' => 'customer'
        ]);
    }

    public function test_unauthenticated_users_cannot_access_admin_api()
    {
        $response = $this->getJson('/api/admin/dashboard');
        $response->assertStatus(401);
    }

    public function test_customers_cannot_access_admin_api()
    {
        Sanctum::actingAs($this->customer);
        $response = $this->getJson('/api/admin/dashboard');
        $response->assertStatus(403);
    }

    public function test_organizers_cannot_access_admin_api()
    {
        Sanctum::actingAs($this->organizer);
        $response = $this->getJson('/api/admin/dashboard');
        $response->assertStatus(403);
    }

    public function test_super_admin_can_access_admin_api()
    {
        Sanctum::actingAs($this->superAdmin);
        
        $endpoints = [
            '/api/admin/dashboard',
            '/api/admin/users',
            '/api/admin/events',
            '/api/admin/bookings',
            '/api/admin/payments',
            '/api/admin/refunds'
        ];

        foreach ($endpoints as $endpoint) {
            $response = $this->getJson($endpoint);
            $response->assertStatus(200);
        }
    }

    public function test_super_admin_can_update_user_role()
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->putJson("/api/admin/users/{$this->customer->id}/role", [
            'role' => 'organizer'
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'id' => $this->customer->id,
            'role' => 'organizer'
        ]);
    }

    public function test_super_admin_cannot_demote_last_super_admin()
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->putJson("/api/admin/users/{$this->superAdmin->id}/role", [
            'role' => 'organizer'
        ]);

        // Assuming our implementation returns 403 when trying to demote the last super admin
        $response->assertStatus(403);
        $this->assertDatabaseHas('users', [
            'id' => $this->superAdmin->id,
            'role' => 'super-admin'
        ]);
    }
}
