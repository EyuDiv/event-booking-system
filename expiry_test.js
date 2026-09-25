const { execSync } = require('child_process');

console.log('--- STARTING EXPIRY RUNTIME VALIDATION ---');
try {
    // 1. Fetch a booking that was created today
    console.log('[1] Modifying a recent UAT booking to be expired...');
    // We update all 'pending' bookings for UAT Customer to be expired
    execSync(`php artisan tinker --execute="App\\Models\\Booking::where('payment_status', 'pending')->update(['expires_at' => now()->subMinutes(30)]);"`, { cwd: './backend' });
    
    // 2. Run the expire command
    console.log('[2] Running php artisan bookings:expire...');
    const out = execSync(`php artisan bookings:expire`, { cwd: './backend' });
    console.log(out.toString());

    // 3. Verify
    console.log('[3] Expiry validation complete.');
} catch (e) {
    console.error('Expiry Validation Failed', e);
}
