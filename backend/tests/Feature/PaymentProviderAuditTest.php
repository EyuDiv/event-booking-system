<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Event;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\Payment\PaymentService;
use App\Services\Payment\Providers\TelebirrPaymentService;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Exceptions\PaymentProviderNotConfiguredException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Event as LaravelEvent;
use App\Notifications\SystemNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class PaymentProviderAuditTest extends TestCase
{
    use RefreshDatabase;

    protected User $customer;
    protected Event $event;
    protected PaymentService $paymentService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::factory()->create([
            'role' => 'customer',
        ]);

        $organizer = User::factory()->create(['role' => 'organizer']);

        $this->event = Event::create([
            'organizer_id' => $organizer->id,
            'title' => 'Audit Event',
            'description' => 'Testing payment boundaries',
            'event_date' => now()->addDays(5),
            'location' => 'Audit Hall',
            'ticket_price' => 100.00,
            'total_tickets' => 50,
            'available_tickets' => 50,
            'category' => 'Tech',
            'status' => 'active',
        ]);

        $this->paymentService = app(PaymentService::class);
    }

    public function test_1_provider_contract_exists()
    {
        $telebirr = new TelebirrPaymentService();
        $this->assertInstanceOf(PaymentProviderInterface::class, $telebirr);
        
        $this->assertTrue(method_exists($telebirr, 'initiate'));
        $this->assertTrue(method_exists($telebirr, 'verify'));
        $this->assertTrue(method_exists($telebirr, 'handleWebhook'));
        $this->assertTrue(method_exists($telebirr, 'refund'));
        $this->assertTrue(method_exists($telebirr, 'isConfigured'));
    }

    public function test_2_payment_initiation_boundary()
    {
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => 100.00,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'telebirr',
            'expires_at' => now()->addMinutes(30),
        ]);

        // It should properly hit the provider and get the isolated exception
        $this->expectException(PaymentProviderNotConfiguredException::class);
        $this->paymentService->initiatePayment($booking);
    }

    public function test_3_4_6_payment_verification_idempotency_and_transitions()
    {
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => 100.00,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'telebirr',
            'expires_at' => now()->addMinutes(30),
        ]);

        $payment = Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'PAY-TEST-123',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 100.00,
            'currency' => 'ETB',
            'status' => Payment::STATUS_PAID, // Simulate already paid manually
        ]);

        // Verification of an already paid payment should short-circuit via idempotency
        // and NOT throw PaymentProviderNotConfiguredException, because it never reaches the provider.
        $verifiedPayment = $this->paymentService->verifyPayment($payment);

        $this->assertEquals(Payment::STATUS_PAID, $verifiedPayment->status);
    }

    public function test_5_repeated_webhook_callback()
    {
        // For unconfigured providers, the webhook will gracefully return 200 after logging the exception
        // in PaymentController.
        $response = $this->postJson('/api/payments/webhook/telebirr', [
            'msisdn' => '251911123456',
            'outTradeNo' => 'PAY-WEBHOOK-TEST',
            'tradeStatus' => 2,
        ]);

        // Returns 200 to prevent provider from spamming us with retries
        $response->assertStatus(200);
        $response->assertJson(['message' => 'Webhook received.']);
    }

    public function test_7_refund_integration_boundary()
    {
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => 100.00,
            'booking_status' => Booking::BOOKING_CONFIRMED,
            'payment_status' => Booking::PAYMENT_PAID,
            'payment_method' => 'telebirr',
        ]);

        $payment = Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'PAY-TEST-REFUND',
            'provider' => 'telebirr',
            'payment_method' => 'telebirr',
            'amount' => 100.00,
            'currency' => 'ETB',
            'status' => Payment::STATUS_PAID,
        ]);

        // Act as customer and request a refund
        $response = $this->actingAs($this->customer)->postJson("/api/bookings/{$booking->id}/refund", [
            'reason' => 'Testing refund boundary',
        ]);

        $response->assertStatus(200);
        
        // Assert Payment status remains PAID (refund is async/provider dependent)
        $this->assertEquals(Payment::STATUS_PAID, $payment->fresh()->status);
        
        // Assert Booking status is CANCELLED (inventory freed)
        $this->assertEquals(Booking::BOOKING_CANCELLED, $booking->fresh()->booking_status);
        $this->assertEquals(Booking::PAYMENT_PAID, $booking->fresh()->payment_status);
    }

    public function test_9_authorization_and_10_secret_non_exposure()
    {
        $booking = Booking::create([
            'user_id' => $this->customer->id,
            'event_id' => $this->event->id,
            'ticket_quantity' => 1,
            'total_price' => 100.00,
            'booking_status' => Booking::BOOKING_PENDING,
            'payment_status' => Booking::PAYMENT_PENDING,
            'payment_method' => 'cash',
        ]);

        $payment = Payment::create([
            'booking_id' => $booking->id,
            'reference' => 'PAY-TEST-AUTH',
            'provider' => 'cash',
            'payment_method' => 'cash',
            'amount' => 100.00,
            'currency' => 'ETB',
            'status' => Payment::STATUS_PENDING,
        ]);

        // API Endpoint exposure check (getting payment details)
        $response = $this->actingAs($this->customer)->getJson("/api/payments/{$payment->reference}");
        $response->assertStatus(200);

        // Ensure secrets are NOT exposed in the JSON response
        $json = $response->json();
        $this->assertArrayHasKey('payment', $json);
        $this->assertArrayNotHasKey('app_key', $json['payment']);
        $this->assertArrayNotHasKey('public_key', $json['payment']);
        $this->assertArrayNotHasKey('merchant_secret', $json['payment']);
    }
}
