import { apiClient } from './api';
import type { AuthUser } from '@/types/auth';
import type { EventItem } from '@/types/event';
import type { BookingItem } from '@/types/booking';

export interface AdminMetrics {
  total_users: number;
  total_events: number;
  active_events: number;
  sold_out_events: number;
  total_bookings: number;
  confirmed_bookings: number;
  pending_bookings: number;
  cancelled_bookings: number;
  tickets_sold: number;
  checked_in_tickets: number;
  total_revenue: number;
}

export interface AdminDashboardResponse {
  metrics: AdminMetrics;
  recent_activity: {
    users: AuthUser[];
    bookings: BookingItem[];
    events: EventItem[];
  };
  charts?: any;
}

export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  const response = await apiClient.get<AdminDashboardResponse>('/api/admin/dashboard');
  return response.data;
}

export interface AdminUsersResponse {
  users: {
    data: AuthUser[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export async function fetchAdminUsers(params?: { search?: string; role?: string; page?: number }): Promise<AdminUsersResponse> {
  const response = await apiClient.get<AdminUsersResponse>('/api/admin/users', { params });
  return response.data;
}

export async function updateAdminUserRole(userId: number, role: string): Promise<{ message: string; user: AuthUser }> {
  const response = await apiClient.put(`/api/admin/users/${userId}/role`, { role });
  return response.data;
}

export interface AdminEventsResponse {
  events: {
    data: EventItem[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export async function fetchAdminEvents(params?: { search?: string; status?: string; page?: number }): Promise<AdminEventsResponse> {
  const response = await apiClient.get<AdminEventsResponse>('/api/admin/events', { params });
  return response.data;
}

export async function updateAdminEventStatus(eventId: number, status: string): Promise<{ message: string; event: EventItem }> {
  const response = await apiClient.put(`/api/admin/events/${eventId}/status`, { status });
  return response.data;
}

export interface AdminBookingsResponse {
  bookings: {
    data: BookingItem[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export async function fetchAdminBookings(params?: { search?: string; booking_status?: string; payment_status?: string; page?: number }): Promise<AdminBookingsResponse> {
  const response = await apiClient.get<AdminBookingsResponse>('/api/admin/bookings', { params });
  return response.data;
}

export interface AdminPaymentsResponse {
  payments: {
    data: any[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export async function fetchAdminPayments(params?: { search?: string; status?: string; page?: number }): Promise<AdminPaymentsResponse> {
  const response = await apiClient.get<AdminPaymentsResponse>('/api/admin/payments', { params });
  return response.data;
}

export interface AdminRefundsResponse {
  refunds: {
    data: any[];
    current_page: number;
    last_page: number;
    total: number;
  };
}

export async function fetchAdminRefunds(params?: { status?: string; page?: number }): Promise<AdminRefundsResponse> {
  const response = await apiClient.get<AdminRefundsResponse>('/api/admin/refunds', { params });
  return response.data;
}
