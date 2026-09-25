<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cancellation & Refund Policy Configuration
    |--------------------------------------------------------------------------
    |
    | cutoff_hours_before_event: The number of hours before the event starts
    | after which a customer can no longer request a cancellation/refund.
    |
    */
    'cutoff_hours_before_event' => env('REFUND_CUTOFF_HOURS', 24),
];
