<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends Model
{
    protected $fillable = [
        'booking_id',
        'ticket_identifier',
        'ticket_token',
        'seat_number',
        'status',
        'checked_in_at',
        'checked_in_by',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'booking_id'    => 'integer',
            'seat_number'   => 'integer',
            'checked_in_at' => 'datetime',
            'cancelled_at'  => 'datetime',
        ];
    }

    // ─── Status constants ──────────────────────────────────────────────────────

    const STATUS_ACTIVE    = 'active';
    const STATUS_USED      = 'used';
    const STATUS_CANCELLED = 'cancelled';

    // ─── Relationships ─────────────────────────────────────────────────────────

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isUsed(): bool
    {
        return $this->status === self::STATUS_USED;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }
}
