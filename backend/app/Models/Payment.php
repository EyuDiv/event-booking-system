<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    protected $fillable = [
        'booking_id',
        'reference',
        'provider',
        'payment_method',
        'amount',
        'currency',
        'provider_reference',
        'status',
        'paid_at',
        'failed_at',
        'refunded_at',
        'cancelled_at',
        'provider_metadata',
        'refund_reference',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount'            => 'decimal:2',
            'booking_id'        => 'integer',
            'provider_metadata' => 'array',
            'paid_at'           => 'datetime',
            'failed_at'         => 'datetime',
            'refunded_at'       => 'datetime',
            'cancelled_at'      => 'datetime',
        ];
    }

    // ─── Status constants ──────────────────────────────────────────────────────

    const STATUS_PENDING   = 'pending';
    const STATUS_PAID      = 'paid';
    const STATUS_FAILED    = 'failed';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_REFUNDED  = 'refunded';

    // ─── Relationships ─────────────────────────────────────────────────────────

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    public function isRefunded(): bool
    {
        return $this->status === self::STATUS_REFUNDED;
    }
}
