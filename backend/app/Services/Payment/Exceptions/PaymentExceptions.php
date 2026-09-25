<?php

namespace App\Services\Payment\Exceptions;

use RuntimeException;

class PaymentInitiationException extends RuntimeException {}
class PaymentVerificationException extends RuntimeException {}
class PaymentWebhookException extends RuntimeException {}
class PaymentRefundException extends RuntimeException {}
class PaymentProviderNotConfiguredException extends RuntimeException {}
class DuplicatePaymentException extends RuntimeException {}
