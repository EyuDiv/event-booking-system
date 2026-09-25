<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Schema matches the Event Booking Platform events table.
     */
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category');
            $table->text('description')->nullable();
            $table->string('location');
            $table->dateTime('event_date');
            $table->decimal('ticket_price', 10, 2);
            $table->unsignedInteger('total_tickets');
            $table->unsignedInteger('available_tickets');
            $table->string('status', 50)->default('draft');
            $table->string('image_url')->nullable();
            $table->foreignId('organizer_id')->constrained('users');
            $table->timestamp('created_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
