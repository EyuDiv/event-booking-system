import type { EventItem } from './event';

export interface BookingRequest {
  event_id: number;
  ticket_quantity: number;
  payment_method: 'telebirr' | 'cbe' | 'cash';
}

export type PaymentState =
  | 'idle'
  | 'initiating'
  | 'pending'
  | 'redirecting'
  | 'verifying'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface TicketItem {
  id: number;
  ticket_identifier: string;
  ticket_token: string;        // QR code value — opaque token
  seat_number: number;
  status: 'active' | 'used' | 'cancelled' | string;
  checked_in_at: string | null;
  event?: {
    title?: string;
    location?: string;
    event_date?: string;
  };
}

export interface BookingItem {
  id: number;
  user_id: number;
  event_id: number;
  ticket_quantity: number;
  total_price: number | string;
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | string;
  payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | string;
  payment_method: 'telebirr' | 'cbe' | 'cash' | string;
  expires_at: string | null;
  created_at: string;
  event?: Partial<EventItem>;
  payment_reference?: string | null;
  tickets?: TicketItem[];
  user?: { id: number; name: string; email: string };
  payment?: { payment_method: string; status: string; reference: string };
}

export interface BookingResponse {
  message: string;
  booking: BookingItem;
}

export interface BookingsListResponse {
  bookings: BookingItem[];
}

export interface PaymentItem {
  reference: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | string;
  provider: string;
  payment_method: string;
  amount: number;
  currency: string;
  provider_reference: string | null;
  checkout_url: string | null;
  payment_qr_data: string | null;
  requires_redirect: boolean;
  instructions: string | null;
  is_existing?: boolean;
  paid_at: string | null;
  failed_at: string | null;
}

export interface PaymentInitiateResponse {
  message: string;
  payment: PaymentItem;
}

export interface PaymentStatusResponse {
  payment: PaymentItem;
}

export interface ValidatedTicket {
  ticket_identifier: string;
  status: 'active' | 'used' | 'cancelled' | string;
  seat_number: number;
  checked_in_at: string | null;
  event?: {
    title?: string;
    location?: string;
    event_date?: string;
  };
  booking?: {
    id?: number;
    payment_status?: string;
  };
}

export interface TicketValidationResponse {
  valid: boolean;
  message: string;
  ticket: ValidatedTicket | null;
}

export interface TicketCheckinResponse {
  message: string;
  ticket: ValidatedTicket;
}
