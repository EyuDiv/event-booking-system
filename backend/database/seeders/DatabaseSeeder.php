<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with one test user per role.
     * Passwords are securely hashed — never stored as plain text.
     */
    public function run(): void
    {
        // Super Admin
        User::updateOrCreate(
            ['email' => 'superadmin@tikethub.com'],
            [
                'name'     => 'Super Admin',
                'password' => Hash::make('password123'),
                'role'     => 'super-admin',
            ]
        );

        // Organizer
        User::updateOrCreate(
            ['email' => 'organizer@tikethub.com'],
            [
                'name'     => 'Event Organizer',
                'password' => Hash::make('password123'),
                'role'     => 'organizer',
            ]
        );

        // Customer
        User::updateOrCreate(
            ['email' => 'customer@tikethub.com'],
            [
                'name'     => 'John Customer',
                'password' => Hash::make('password123'),
                'role'     => 'customer',
            ]
        );
        
        $this->command->info('✅ Seeded 3 test users (super-admin, organizer, customer) — password: password123');

        $this->call([
            EventSeeder::class,
        ]);
    }
}
