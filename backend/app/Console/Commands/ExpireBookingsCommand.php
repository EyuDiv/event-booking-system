<?php

namespace App\Console\Commands;

use App\Services\Payment\BookingExpiryService;
use Illuminate\Console\Command;

class ExpireBookingsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bookings:expire';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Expire pending bookings past their reservation time and release ticket inventory.';

    /**
     * Execute the console command.
     */
    public function handle(BookingExpiryService $expiryService): int
    {
        $this->info('Checking for expired pending bookings...');

        $result = $expiryService->expireAllExpiredBookings();

        $expiredCount = $result['expired_bookings'];
        $ticketsReleased = $result['released_tickets'];

        if ($expiredCount > 0) {
            $this->info("Successfully expired {$expiredCount} booking(s) and released {$ticketsReleased} ticket(s) back to inventory.");
        } else {
            $this->line('No expired bookings found.');
        }

        return Command::SUCCESS;
    }
}
