<?php

namespace Database\Seeders;

use App\Models\Event;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class EventSeeder extends Seeder
{
    /**
     * Seed events table with real Ethiopian events matching the Stitch UI design.
     */
    public function run(): void
    {
        $organizer = User::where('role', 'organizer')->first() ?? User::first();
        $organizerId = $organizer ? $organizer->id : 1;

        $events = [
            [
                'title' => 'Ethiopian New Year Music Fest',
                'category' => 'Music',
                'description' => 'Vibrant Ethiopian festival performance with traditional dancers and contemporary musicians under warm golden spotlights at Millennium Hall.',
                'location' => 'Addis Ababa Millennium Hall',
                'event_date' => Carbon::now()->addDays(2)->setHour(18)->setMinute(0)->setSecond(0),
                'ticket_price' => 650.00,
                'total_tickets' => 200,
                'available_tickets' => 15,
                'status' => 'active',
                'image_url' => 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Addis Tech Summit 2025',
                'category' => 'Technology',
                'description' => 'Keynote presentations, artificial intelligence panels, and startup showcases with African tech founders and executives.',
                'location' => 'Skylight Hotel Addis Ababa',
                'event_date' => Carbon::now()->addDays(5)->setHour(9)->setMinute(0)->setSecond(0),
                'ticket_price' => 1200.00,
                'total_tickets' => 500,
                'available_tickets' => 350,
                'status' => 'active',
                'image_url' => 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Afro-Jazz Night at Fendika',
                'category' => 'Cultural',
                'description' => 'Intimate acoustic jazz night in Kazanchis featuring saxophonists, krar players, and traditional drums performing in mood lighting.',
                'location' => 'Kazanchis Addis Ababa',
                'event_date' => Carbon::now()->addDays(9)->setHour(20)->setMinute(0)->setSecond(0),
                'ticket_price' => 400.00,
                'total_tickets' => 100,
                'available_tickets' => 0,
                'status' => 'sold_out',
                'image_url' => 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Entoto Trail Run & Camp',
                'category' => 'Cultural',
                'description' => 'Lush eucalyptus forest mountain run with early morning mist, outdoor active trail runners, and camping under the sunrise.',
                'location' => 'Entoto Park',
                'event_date' => Carbon::now()->addDays(12)->setHour(6)->setMinute(30)->setSecond(0),
                'ticket_price' => 350.00,
                'total_tickets' => 150,
                'available_tickets' => 8,
                'status' => 'active',
                'image_url' => 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Fintech & Startup Expo',
                'category' => 'Networking',
                'description' => 'Modern exhibition hall featuring digital fintech displays, entrepreneur networking, and high-impact delegate pitches.',
                'location' => 'UNECA Conference Center',
                'event_date' => Carbon::now()->addDays(16)->setHour(10)->setMinute(0)->setSecond(0),
                'ticket_price' => 800.00,
                'total_tickets' => 400,
                'available_tickets' => 280,
                'status' => 'active',
                'image_url' => 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Taste of Ethiopia Food Festival',
                'category' => 'Food & Drinks',
                'description' => 'Sun-drenched botanical garden dining celebration featuring traditional cuisine, jebena buna coffee ceremonies, and gourmet tastings.',
                'location' => 'Ghion Hotel Gardens',
                'event_date' => Carbon::now()->addDays(20)->setHour(13)->setMinute(0)->setSecond(0),
                'ticket_price' => 500.00,
                'total_tickets' => 300,
                'available_tickets' => 190,
                'status' => 'active',
                'image_url' => 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
            [
                'title' => 'Internal Organizer Planning Workshop',
                'category' => 'Technology',
                'description' => 'Internal draft planning session for organizers. Must never be visible to customers.',
                'location' => 'TiketHub HQ Addis Ababa',
                'event_date' => Carbon::now()->addDays(30)->setHour(14)->setMinute(0)->setSecond(0),
                'ticket_price' => 0.00,
                'total_tickets' => 20,
                'available_tickets' => 20,
                'status' => 'draft',
                'image_url' => null,
                'organizer_id' => $organizerId,
                'created_at' => now(),
            ],
        ];

        foreach ($events as $eventData) {
            Event::updateOrCreate(
                ['title' => $eventData['title']],
                $eventData
            );
        }

        $this->command->info('✅ Seeded ' . count($events) . ' events into MySQL.');
    }
}
