<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the tickets table.
     *
     * One ticket record is generated per attendee within a booking.
     * A booking for 3 tickets → 3 ticket rows.
     *
     * Ticket lifecycle:
     *   active    → valid ticket, payment confirmed
     *   used      → scanned at event entrance (checked in)
     *   cancelled → booking cancelled or payment refunded
     *
     * SECURITY:
     *   - ticket_token is the QR code identifier. It is a random, opaque token.
     *   - It contains NO personal data, NO payment info, NO secrets.
     *   - ticket_identifier is a user-friendly unique identifier (e.g. TKT-XXXXXX).
     */
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();

            // --- Booking relationship ---
            $table->foreignId('booking_id')
                ->constrained('bookings')
                ->cascadeOnDelete();

            // --- Human-readable ticket identifier (e.g. TKT-A1B2C3) ---
            $table->string('ticket_identifier', 32)->unique();

            // --- QR token — random opaque identifier for QR code ---
            // This is what goes inside the QR code. Nothing sensitive.
            $table->string('ticket_token', 128)->unique();

            // --- Which ticket within the booking (1 of N, 2 of N, etc.) ---
            $table->unsignedTinyInteger('seat_number')->default(1);

            // --- Ticket status ---
            $table->string('status', 50)->default('active');
            // Allowed: active | used | cancelled

            // --- Check-in information ---
            $table->timestamp('checked_in_at')->nullable();
            $table->string('checked_in_by', 255)->nullable(); // User or system that performed check-in

            // --- Timestamps ---
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            // --- Indexes ---
            $table->index('booking_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
