<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Event extends Model
{
    const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'title',
        'category',
        'description',
        'location',
        'event_date',
        'ticket_price',
        'total_tickets',
        'available_tickets',
        'status',
        'image_url',
        'organizer_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_date' => 'datetime',
            'ticket_price' => 'decimal:2',
            'total_tickets' => 'integer',
            'available_tickets' => 'integer',
            'organizer_id' => 'integer',
        ];
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organizer_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class, 'event_id');
    }

    public function payments(): HasManyThrough
    {
        return $this->hasManyThrough(Payment::class, Booking::class);
    }

    public function tickets(): HasManyThrough
    {
        return $this->hasManyThrough(Ticket::class, Booking::class);
    }
}
