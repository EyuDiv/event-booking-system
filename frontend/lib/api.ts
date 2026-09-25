import axios, { AxiosError } from 'axios';
import type { LoginRequest, RegisterRequest, LoginResponse, ApiError, AuthUser } from '@/types/auth';
import type { EventsResponse, EventDetailsResponse } from '@/types/event';
import type {
  BookingRequest,
  BookingResponse,
  BookingsListResponse,
  PaymentInitiateResponse,
  PaymentStatusResponse,
} from '@/types/booking';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Shared Axios instance for all backend API communication.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor to attach Bearer token if available
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // Automatically remove Content-Type if payload is FormData so browser/Axios sets multipart boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to normalize error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> } | string>) => {
    const apiError: ApiError = {
      message: 'Something went wrong. Please try again.',
      status: error.response?.status,
    };

    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data === 'string') {
        try {
          const jsonMatch = data.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.message) apiError.message = parsed.message;
            if (parsed.errors) apiError.errors = parsed.errors;
          } else {
            apiError.message = data.length < 200 ? data : 'Server returned an invalid response.';
          }
        } catch {
          apiError.message = 'Unable to process server response.';
        }
      } else if (typeof data === 'object' && data !== null) {
        if (data.message) {
          apiError.message = data.message;
        }
        if (data.errors) {
          apiError.errors = data.errors;
        }
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      apiError.message = 'Connection timed out. Please check your network and try again.';
    } else if (!error.response) {
      apiError.message = 'Unable to connect to the server. Please verify the backend is running.';
    }

    const requestUrl = error.config?.url ?? '';
    const isAuthAttempt = requestUrl.includes('/api/login') || requestUrl.includes('/api/register');
    if (error.response?.status === 401 && !isAuthAttempt) {
      clearStoredAuth();
    }

    return Promise.reject(apiError);
  }
);

/**
 * Log in with email and password via Laravel REST API.
 */
export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/login', credentials);
  return response.data;
}

/**
 * Register a new customer account via Laravel REST API.
 */
export async function registerUser(data: RegisterRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/register', data);
  return response.data;
}

/**
 * Fetch Google OAuth 2.0 authorization URL from Laravel backend.
 */
export async function getGoogleAuthUrl(): Promise<{ configured: boolean; url?: string; state?: string; message?: string }> {
  try {
    const response = await apiClient.get<{ configured: boolean; url: string; state: string }>('/api/auth/google/url');
    return response.data;
  } catch (error) {
    const apiErr = error as ApiError;
    return {
      configured: false,
      message: apiErr.message || 'Google OAuth is not configured on this server.',
    };
  }
}

/**
 * Exchange Google OAuth authorization code for Sanctum authentication session.
 */
export async function exchangeGoogleAuthCode(code: string, state?: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/api/auth/google/callback', {
    code,
    state,
  });
  return response.data;
}


/**
 * Log out current authenticated session.
 */
export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/api/logout');
  } finally {
    clearStoredAuth();
  }
}

/**
 * Store authenticated user data securely in localStorage.
 */
export function setStoredAuth(data: LoginResponse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('auth_user', JSON.stringify(data.user));
}

/**
 * Retrieve current authenticated session from localStorage.
 */
export function getStoredAuth(): { user: AuthUser | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }
  const token = localStorage.getItem('auth_token');
  const userStr = localStorage.getItem('auth_user');
  let user: AuthUser | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }
  return { user, token };
}

/**
 * Clear authenticated session.
 */
export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

/**
 * Role-aware redirection path generator.
 */
export function getRoleDashboardPath(role: string): string {
  switch (role) {
    case 'super-admin':
      return '/admin';
    case 'organizer':
      return '/organizer/dashboard';
    case 'customer':
    default:
      return '/';
  }
}

/**
 * Fetch publicly listed events from Laravel (active + sold_out).
 */
export async function fetchEvents(params?: {
  search?: string;
  category?: string;
  date_filter?: string;
}): Promise<EventsResponse> {
  const response = await apiClient.get<EventsResponse>('/api/events', {
    params: {
      search: params?.search || undefined,
      category: params?.category && params.category !== 'all' ? params.category : undefined,
      date_filter: params?.date_filter && params.date_filter !== 'all' ? params.date_filter : undefined,
    },
  });
  return response.data;
}

/**
 * Fetch a single event's details from Laravel (active or sold_out).
 */
export async function fetchEventById(id: string | number): Promise<EventDetailsResponse> {
  const response = await apiClient.get<EventDetailsResponse>(`/api/events/${id}`);
  return response.data;
}

/**
 * Submit an authenticated booking request to Laravel REST API.
 * Creates a booking in PENDING state — requires payment initiation to confirm.
 */
export async function createBooking(data: BookingRequest): Promise<BookingResponse> {
  const response = await apiClient.post<BookingResponse>('/api/bookings', data);
  return response.data;
}

/**
 * Fetch all bookings for the authenticated customer (My Bookings).
 */
export async function fetchMyBookings(): Promise<BookingsListResponse> {
  const response = await apiClient.get<BookingsListResponse>('/api/bookings');
  return response.data;
}

/**
 * Fetch a single booking by ID for the authenticated customer.
 */
export async function fetchBookingById(id: number): Promise<{ booking: import('@/types/booking').BookingItem }> {
  const response = await apiClient.get(`/api/bookings/${id}`);
  return response.data;
}

/**
 * Initiate payment for a booking.
 * Backend validates ownership, calculates amount, and returns provider instructions.
 */
export async function initiatePayment(bookingId: number): Promise<PaymentInitiateResponse> {
  const response = await apiClient.post<PaymentInitiateResponse>('/api/payments/initiate', {
    booking_id: bookingId,
  });
  return response.data;
}

/**
 * Get payment status by internal reference.
 */
export async function fetchPaymentStatus(reference: string): Promise<PaymentStatusResponse> {
  const response = await apiClient.get<PaymentStatusResponse>(`/api/payments/${reference}`);
  return response.data;
}

/**
 * Trigger backend payment verification.
 * Called after customer returns from provider checkout.
 * Backend verifies with the provider — NOT frontend claim.
 */
export async function verifyPayment(reference: string): Promise<PaymentStatusResponse> {
  const response = await apiClient.post<PaymentStatusResponse>(`/api/payments/${reference}/verify`);
  return response.data;
}

/**
 * Fetch tickets for a confirmed booking.
 */
export async function fetchBookingTickets(bookingId: number): Promise<{
  booking_id: number;
  tickets: import('@/types/booking').TicketItem[];
}> {
  const response = await apiClient.get(`/api/bookings/${bookingId}/ticket`);
  return response.data;
}

/**
 * Cancel a booking (only allowed for unpaid bookings).
 */
export async function cancelBooking(bookingId: number): Promise<{ message: string }> {
  const response = await apiClient.post(`/api/bookings/${bookingId}/cancel`);
  return response.data;
}

/**
 * Validate a ticket token for entrance check-in (Staff / Organizer / Admin).
 */
export async function validateTicketToken(token: string): Promise<import('@/types/booking').TicketValidationResponse> {
  const response = await apiClient.get<import('@/types/booking').TicketValidationResponse>(`/api/tickets/${token}/validate`);
  return response.data;
}

/**
 * Check in a ticket by its token at event entrance (Staff / Organizer / Admin).
 */
export async function checkinTicket(token: string): Promise<import('@/types/booking').TicketCheckinResponse> {
  const response = await apiClient.post<import('@/types/booking').TicketCheckinResponse>(`/api/tickets/${token}/checkin`);
  return response.data;
}

// ─── Organizer Event Management ───────────────────────────────────────────────

export interface OrganizerEventPayload {
  title: string;
  category: string;
  description?: string;
  location: string;
  event_date: string;   // ISO 8601 — backend validates 'after:now' on create
  ticket_price: number;
  total_tickets: number;
  status: 'active' | 'draft';
  image?: File | null;
  image_url?: string | null;
}

export interface OrganizerEventsResponse {
  events: import('@/types/event').EventItem[];
}

export interface OrganizerEventResponse {
  event: import('@/types/event').EventItem;
}

/**
 * Fetch all events owned by the authenticated organizer (includes drafts).
 */
export async function fetchOrganizerEvents(): Promise<OrganizerEventsResponse> {
  const response = await apiClient.get<OrganizerEventsResponse>('/api/organizer/events');
  return response.data;
}

/**
 * Fetch a single organizer-owned event (including draft).
 */
export async function fetchOrganizerEvent(id: number): Promise<OrganizerEventResponse> {
  const response = await apiClient.get<OrganizerEventResponse>(`/api/organizer/events/${id}`);
  return response.data;
}

/**
 * Create a new event as an organizer.
 */
export async function createOrganizerEvent(
  data: OrganizerEventPayload
): Promise<{ message: string; event: import('@/types/event').EventItem }> {
  let payload: any;

  if (data.image instanceof File) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('category', data.category);
    if (data.description) {
      formData.append('description', data.description);
    }
    formData.append('location', data.location);
    formData.append('event_date', data.event_date);
    formData.append('ticket_price', String(data.ticket_price));
    formData.append('total_tickets', String(data.total_tickets));
    formData.append('status', data.status);
    formData.append('image', data.image);
    payload = formData;
  } else {
    payload = {
      title: data.title,
      category: data.category,
      description: data.description || undefined,
      location: data.location,
      event_date: data.event_date,
      ticket_price: data.ticket_price,
      total_tickets: data.total_tickets,
      status: data.status,
    };
  }

  const response = await apiClient.post<{ message: string; event: import('@/types/event').EventItem }>(
    '/api/organizer/events',
    payload
  );
  return response.data;
}

/**
 * Update an organizer-owned event.
 */
export async function updateOrganizerEvent(
  id: number,
  data: Partial<OrganizerEventPayload> & { status?: 'active' | 'draft' | 'sold_out' | 'cancelled' }
): Promise<{ message: string; event: import('@/types/event').EventItem }> {
  if (data.image instanceof File || data.image === null) {
    const formData = new FormData();
    formData.append('_method', 'PUT'); // Laravel requirement for multipart PUT requests
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'image' && value instanceof File) {
          formData.append(key, value);
        } else if (key !== 'image') {
          formData.append(key, String(value));
        }
      }
    });

    // We must use POST when sending FormData with _method=PUT in Laravel
    const response = await apiClient.post<{ message: string; event: import('@/types/event').EventItem }>(
      `/api/organizer/events/${id}`,
      formData
    );
    return response.data;
  }

  const response = await apiClient.put<{ message: string; event: import('@/types/event').EventItem }>(
    `/api/organizer/events/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete a draft event. Only succeeds if there are no confirmed bookings.
 */
export async function deleteOrganizerEvent(id: number): Promise<{ message: string }> {
  const response = await apiClient.delete(`/api/organizer/events/${id}`);
  return response.data;
}

// ─── Organizer Booking / Attendee Management ─────────────────────────────────

export interface OrganizerBookingTicket {
  id: number;
  ticket_identifier: string;
  seat_number: number;
  status: 'active' | 'used' | 'cancelled' | string;
  checked_in_at: string | null;
  // ticket_token intentionally omitted — use Gate Check-in portal for scanning
}

export interface OrganizerBookingPayment {
  reference: string;
  status: string;
  provider: string;
  payment_method: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  failed_at: string | null;
}

export interface OrganizerBookingItem {
  id: number;
  ticket_quantity: number;
  total_price: number;
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | string;
  payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | string;
  payment_method: string;
  created_at: string;
  expires_at: string | null;
  customer: {
    id: number;
    name: string;
    email: string;
  } | null;
  payment: OrganizerBookingPayment | null;
  tickets: OrganizerBookingTicket[];
}

export interface OrganizerBookingsStats {
  total_bookings: number;
  tickets_sold: number;
  confirmed_bookings: number;
  pending_bookings: number;
  checked_in_count: number;
}

export interface OrganizerBookingsPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface OrganizerBookingsResponse {
  event: import('@/types/event').EventItem;
  stats: OrganizerBookingsStats;
  bookings: OrganizerBookingItem[];
  pagination: OrganizerBookingsPagination;
}

export interface OrganizerBookingsFilters {
  search?: string;
  booking_status?: string;
  payment_status?: string;
  ticket_status?: string;
  page?: number;
  per_page?: number;
}

/**
 * Fetch attendee bookings for an organizer-owned event.
 * Supports filtering and pagination.
 */
export async function fetchOrganizerEventBookings(
  eventId: number,
  filters?: OrganizerBookingsFilters
): Promise<OrganizerBookingsResponse> {
  const response = await apiClient.get<OrganizerBookingsResponse>(
    `/api/organizer/events/${eventId}/bookings`,
    { params: filters }
  );
  return response.data;
}

// ─── Organizer Analytics ───────────────────────────────────────────────────────

export interface OrganizerAnalyticsOverall {
  total_events: number;
  active_events: number;
  draft_events: number;
  sold_out_events: number;
  total_bookings: number;
  confirmed_bookings: number;
  pending_bookings: number;
  cancelled_bookings: number;
  expired_bookings: number;
  total_tickets_available: number;
  total_tickets_sold: number;
  checked_in_tickets: number;
  total_revenue: number;
}

export interface OrganizerAnalyticsEvent {
  id: number;
  title: string;
  category: string;
  location: string;
  status: string;
  total_tickets: number;
  available_tickets: number;
  total_bookings_count: number;
  confirmed_bookings_count: number;
  pending_bookings_count: number;
  cancelled_bookings_count: number;
  expired_bookings_count: number;
  checked_in_tickets_count: number;
  revenue: number;
}

export interface OrganizerAnalyticsResponse {
  overall: OrganizerAnalyticsOverall;
  events: OrganizerAnalyticsEvent[];
}

export interface OrganizerEventAnalyticsResponse {
  event: OrganizerAnalyticsEvent;
}

export async function fetchOrganizerAnalytics(): Promise<OrganizerAnalyticsResponse> {
  const response = await apiClient.get<OrganizerAnalyticsResponse>('/api/organizer/analytics');
  return response.data;
}

export async function fetchOrganizerEventAnalytics(eventId: number): Promise<OrganizerEventAnalyticsResponse> {
  const response = await apiClient.get<OrganizerEventAnalyticsResponse>(`/api/organizer/events/${eventId}/analytics`);
  return response.data;
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function fetchNotifications(page: number = 1): Promise<NotificationsResponse> {
  const response = await apiClient.get<NotificationsResponse>(`/api/notifications?page=${page}`);
  return response.data;
}

export async function fetchUnreadNotificationCount(): Promise<{ count: number }> {
  const response = await apiClient.get<{ count: number }>('/api/notifications/unread-count');
  return response.data;
}

export async function markNotificationAsRead(id: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(`/api/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/api/notifications/read-all');
  return response.data;
}

// ─── Refunds ───────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: {
    data: Notification[];
    current_page: number;
    last_page: number;
  };
}

export interface RefundRequestResponse {
  message: string;
  refund_request?: {
    id: number;
    booking_id: number;
    status: string;
    amount: string;
  };
}

export async function requestRefund(bookingId: number, reason: string): Promise<RefundRequestResponse> {
  const response = await apiClient.post<RefundRequestResponse>(`/api/bookings/${bookingId}/refund`, { reason });
  return response.data;
}

