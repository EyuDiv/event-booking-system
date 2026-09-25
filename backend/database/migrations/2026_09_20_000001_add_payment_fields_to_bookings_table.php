<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extend the bookings table with fields required for the payment lifecycle.
     *
     * Adds:
     *  - expires_at       : Timestamp at which an unpaid booking reservation expires.
     *  - updated_at       : Tracks status transitions (payment confirmed, cancelled, etc.).
     *  - cancelled_at     : Populated when a booking is cancelled.
     *
     * NOTE:
     *  - payment_status and payment_method already exist on the bookings table.
     *  - booking_status already exists (default 'confirmed').
     *  - We change booking_status default to 'pending' for new payment-driven flow.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Reservation expiry — used to release tickets when payment never completes
            $table->timestamp('expires_at')->nullable()->after('payment_method');

            // Timestamp for cancellation
            $table->timestamp('cancelled_at')->nullable()->after('expires_at');

            // Add updated_at (bookings table was created without it)
            $table->timestamp('updated_at')->nullable()->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['expires_at', 'cancelled_at', 'updated_at']);
        });
    }
};
