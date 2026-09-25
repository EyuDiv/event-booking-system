<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Booking extends Model
{
    protected $fillable = [
        'user_id',
        'event_id',
        'ticket_quantity',
        'total_price',
        'booking_status',
        'payment_status',
        'payment_method',
        'expires_at',
        'cancelled_at',
        'created_at',
    ];

    // ─── Status constants ──────────────────────────────────────────────────────

    // Booking status
    const BOOKING_PENDING    = 'pending';
    const BOOKING_CONFIRMED  = 'confirmed';
    const BOOKING_CANCELLED  = 'cancelled';
    const BOOKING_EXPIRED    = 'expired';

    // Payment status (mirrors Payment::STATUS_*)
    const PAYMENT_PENDING    = 'pending';
    const PAYMENT_PAID       = 'paid';
    const PAYMENT_FAILED     = 'failed';
    const PAYMENT_CANCELLED  = 'cancelled';
    const PAYMENT_REFUNDED   = 'refunded';

    // ─── Casts ─────────────────────────────────────────────────────────────────

    protected function casts(): array
    {
        return [
            'ticket_quantity' => 'integer',
            'total_price'     => 'decimal:2',
            'user_id'         => 'integer',
            'event_id'        => 'integer',
            'created_at'      => 'datetime',
            'expires_at'      => 'datetime',
            'cancelled_at'    => 'datetime',
        ];
    }

    // ─── Relationships ─────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'event_id');
    }

    /**
     * All payment attempts for this booking.
     * Multiple attempts possible (e.g. first failed, second succeeded).
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'booking_id');
    }

    /**
     * The single successful (paid) payment for this booking.
     */
    public function paidPayment(): HasOne
    {
        return $this->hasOne(Payment::class, 'booking_id')
                    ->where('status', Payment::STATUS_PAID)
                    ->latestOfMany();
    }

    /**
     * The most recent payment attempt.
     */
    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class, 'booking_id')->latestOfMany();
    }

    /**
     * All generated tickets for this booking.
     */
    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'booking_id');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    public function isPaid(): bool
    {
        return $this->payment_status === self::PAYMENT_PAID;
    }

    public function isPending(): bool
    {
        return $this->payment_status === self::PAYMENT_PENDING;
    }

    public function isCancelled(): bool
    {
        return $this->booking_status === self::BOOKING_CANCELLED;
    }

    public function isExpired(): bool
    {
        return $this->booking_status === self::BOOKING_EXPIRED;
    }

    /**
     * Does this booking already have an active (non-failed, non-cancelled) payment?
     */
    public function hasActivePayment(): bool
    {
        return $this->payments()
            ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_PAID])
            ->exists();
    }

    /**
     * The refund request for this booking, if any.
     */
    public function refundRequest(): HasOne
    {
        return $this->hasOne(RefundRequest::class, 'booking_id');
    }
}
