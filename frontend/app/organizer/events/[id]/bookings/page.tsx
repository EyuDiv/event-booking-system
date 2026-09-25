'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  getStoredAuth,
  logoutUser,
  fetchOrganizerEventBookings,
} from '@/lib/api';
import type {
  OrganizerBookingItem,
  OrganizerBookingsStats,
  OrganizerBookingsPagination,
  OrganizerBookingsFilters,
} from '@/lib/api';
import type { EventItem } from '@/types/event';
import type { AuthUser } from '@/types/auth';
import type { ApiError } from '@/types/auth';

// ─── Badges ───────────────────────────────────────────────────────────────────

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending:   'bg-amber-100 text-amber-700 border-amber-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
    expired:   'bg-slate-100 text-slate-500 border-slate-200',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls} capitalize`}>
      {status}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending:   'bg-amber-100 text-amber-700 border-amber-200',
    failed:    'bg-red-100 text-red-600 border-red-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
    refunded:  'bg-blue-100 text-blue-700 border-blue-200',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls} capitalize`}>
      {status}
    </span>
  );
}

function TicketStatusPill({ status }: { status: string }) {
  if (status === 'used') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <span className="material-symbols-outlined text-[11px]">check_circle</span>
        Checked In
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
        <span className="material-symbols-outlined text-[11px]">confirmation_number</span>
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 capitalize">
      {status}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div>
        <div className="text-[20px] font-extrabold text-[#131b2e] leading-tight">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, onClose }: { booking: OrganizerBookingItem; onClose: () => void }) {
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 className="text-[16px] font-bold text-[#131b2e]">Booking #{booking.id}</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">{fmtDate(booking.created_at)}</p>
          </div>
          <button
            id={`close-modal-${booking.id}`}
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-600">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer */}
          <section>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Customer</div>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-[13px]">
              <div className="font-semibold text-[#131b2e]">{booking.customer?.name ?? '—'}</div>
              <div className="text-slate-500">{booking.customer?.email ?? '—'}</div>
              {booking.customer?.id && (
                <div className="text-slate-400 text-[11px]">ID #{booking.customer.id}</div>
              )}
            </div>
          </section>

          {/* Booking */}
          <section>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Booking Details</div>
            <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <div className="text-slate-400">Quantity</div>
                <div className="font-semibold text-[#131b2e]">{booking.ticket_quantity} ticket{booking.ticket_quantity !== 1 ? 's' : ''}</div>
              </div>
              <div>
                <div className="text-slate-400">Total Price</div>
                <div className="font-semibold text-[#712ae2]">
                  ETB {Number(booking.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Booking Status</div>
                <div className="mt-0.5"><BookingStatusBadge status={booking.booking_status} /></div>
              </div>
              <div>
                <div className="text-slate-400">Payment Status</div>
                <div className="mt-0.5"><PaymentStatusBadge status={booking.payment_status} /></div>
              </div>
              <div>
                <div className="text-slate-400">Payment Method</div>
                <div className="font-semibold text-[#131b2e] capitalize">{booking.payment_method}</div>
              </div>
              <div>
                <div className="text-slate-400">Created</div>
                <div className="font-semibold text-[#131b2e]">{fmtDate(booking.created_at)}</div>
              </div>
            </div>
          </section>

          {/* Payment */}
          {booking.payment && (
            <section>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Record</div>
              <div className="bg-slate-50 rounded-xl p-3 space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Reference</span>
                  <span className="font-mono text-[#131b2e] text-[11px]">{booking.payment.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Provider</span>
                  <span className="font-semibold capitalize">{booking.payment.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span className="font-semibold text-[#712ae2]">
                    {booking.payment.currency} {Number(booking.payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {booking.payment.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paid At</span>
                    <span className="font-semibold text-emerald-700">{fmtDate(booking.payment.paid_at)}</span>
                  </div>
                )}
                {booking.payment.failed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Failed At</span>
                    <span className="font-semibold text-red-600">{fmtDate(booking.payment.failed_at)}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tickets */}
          {booking.tickets.length > 0 && (
            <section>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tickets ({booking.tickets.length})
              </div>
              <div className="space-y-2">
                {booking.tickets.map((t) => (
                  <div key={t.id} className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-[12px]">
                    <div>
                      <div className="font-mono font-semibold text-[#131b2e]">{t.ticket_identifier}</div>
                      <div className="text-slate-400">Seat #{t.seat_number}</div>
                      {t.checked_in_at && (
                        <div className="text-emerald-600 text-[11px] mt-0.5">
                          Checked in {fmtDate(t.checked_in_at)}
                        </div>
                      )}
                    </div>
                    <TicketStatusPill status={t.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {booking.tickets.length === 0 && (
            <div className="text-[12px] text-slate-400 text-center py-2">
              No tickets generated yet (booking may be pending/unpaid).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Booking Row (Desktop table) ──────────────────────────────────────────────

function BookingRow({ booking, onSelect }: { booking: OrganizerBookingItem; onSelect: () => void }) {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const checkedIn    = booking.tickets.filter((t) => t.status === 'used').length;
  const totalTickets = booking.tickets.length;

  return (
    <tr
      className="border-b border-slate-100 hover:bg-purple-50/40 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <td className="px-4 py-3 text-[12px] font-mono text-slate-500">#{booking.id}</td>
      <td className="px-4 py-3">
        <div className="text-[13px] font-semibold text-[#131b2e]">{booking.customer?.name ?? '—'}</div>
        <div className="text-[11px] text-slate-400">{booking.customer?.email ?? '—'}</div>
      </td>
      <td className="px-4 py-3 text-[13px] text-center text-slate-700">{booking.ticket_quantity}</td>
      <td className="px-4 py-3 text-[13px] font-semibold text-[#712ae2]">
        ETB {Number(booking.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-3"><BookingStatusBadge status={booking.booking_status} /></td>
      <td className="px-4 py-3"><PaymentStatusBadge status={booking.payment_status} /></td>
      <td className="px-4 py-3">
        {totalTickets > 0 ? (
          <span className={`text-[12px] font-semibold ${checkedIn === totalTickets ? 'text-emerald-600' : checkedIn > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {checkedIn}/{totalTickets}
          </span>
        ) : (
          <span className="text-slate-300 text-[12px]">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[11px] text-slate-400">{fmtDate(booking.created_at)}</td>
      <td className="px-4 py-3">
        <button
          id={`view-booking-${booking.id}`}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#712ae2] bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          View
        </button>
      </td>
    </tr>
  );
}

// ─── Booking Card (Mobile) ────────────────────────────────────────────────────

function BookingCard({ booking, onSelect }: { booking: OrganizerBookingItem; onSelect: () => void }) {
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const checkedIn    = booking.tickets.filter((t) => t.status === 'used').length;
  const totalTickets = booking.tickets.length;

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-[13px] font-bold text-[#131b2e]">{booking.customer?.name ?? '—'}</div>
          <div className="text-[11px] text-slate-400">{booking.customer?.email ?? '—'}</div>
        </div>
        <div className="text-[11px] font-mono text-slate-400">#{booking.id}</div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <BookingStatusBadge status={booking.booking_status} />
        <PaymentStatusBadge status={booking.payment_status} />
        {booking.tickets.map((t) => (
          <TicketStatusPill key={t.id} status={t.status} />
        ))}
      </div>

      <div className="flex items-center justify-between text-[12px] text-slate-500">
        <span>{booking.ticket_quantity} ticket{booking.ticket_quantity !== 1 ? 's' : ''}</span>
        <span className="font-bold text-[#712ae2]">
          ETB {Number(booking.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
      {totalTickets > 0 && (
        <div className={`text-[11px] mt-1 ${checkedIn === totalTickets ? 'text-emerald-600' : 'text-slate-400'}`}>
          {checkedIn}/{totalTickets} checked in
        </div>
      )}
      <div className="text-[10px] text-slate-300 mt-1">{fmtDate(booking.created_at)}</div>
    </div>
  );
}

// ─── Select input ─────────────────────────────────────────────────────────────

const selectCls =
  'px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 focus:outline-none focus:border-[#712ae2] focus:ring-1 focus:ring-[#712ae2]/10 transition-all';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrganizerEventBookingsPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = Number(params?.id);

  const [user, setUser]           = useState<AuthUser | null>(null);
  const [event, setEvent]         = useState<EventItem | null>(null);
  const [bookings, setBookings]   = useState<OrganizerBookingItem[]>([]);
  const [stats, setStats]         = useState<OrganizerBookingsStats | null>(null);
  const [pagination, setPagination] = useState<OrganizerBookingsPagination | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<OrganizerBookingItem | null>(null);

  // Filters
  const [search, setSearch]               = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [ticketStatus, setTicketStatus]   = useState('');
  const [page, setPage]                   = useState(1);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBookings = useCallback(async (filters: OrganizerBookingsFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizerEventBookings(eventId, filters);
      setEvent(data.event);
      setStats(data.stats);
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) { router.push('/login'); return; }
      if (ae.status === 403) { router.push('/organizer/events'); return; }
      if (ae.status === 404) { router.push('/organizer/events'); return; }
      setError(ae.message ?? 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  // Initial auth check
  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) { router.push('/login'); return; }
    if (!['organizer', 'super-admin'].includes(authUser.role ?? '')) { router.push('/'); return; }
    setUser(authUser);
  }, [router]);

  // Load on filter/page change
  useEffect(() => {
    if (!user) return;
    loadBookings({ search: search || undefined, booking_status: bookingStatus || undefined, payment_status: paymentStatus || undefined, ticket_status: ticketStatus || undefined, page, per_page: 25 });
  }, [user, bookingStatus, paymentStatus, ticketStatus, page, loadBookings]); // search handled via debounce below

  // Debounced search
  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadBookings({ search: val || undefined, booking_status: bookingStatus || undefined, payment_status: paymentStatus || undefined, ticket_status: ticketStatus || undefined, page: 1, per_page: 25 });
    }, 400);
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  const fmtEventDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Loading skeleton ──
  if (loading && !event) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#712ae2] text-[28px]">campaign</span>
          <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          <span className="ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Organizer Studio</span>
        </header>
        <main className="max-w-6xl mx-auto w-full p-6 sm:p-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-100 rounded w-1/3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
            </div>
            <div className="h-64 bg-slate-100 rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/organizer/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-[#712ae2] text-[28px]">campaign</span>
            <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          </Link>
          <span className="hidden min-[420px]:inline-block ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
            Organizer Studio
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-bold text-[#131b2e]">{user?.name}</div>
            <div className="text-[11px] text-slate-500">{user?.email}</div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 sm:p-10 flex-grow">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-6 flex-wrap">
          <Link href="/organizer/dashboard" className="hover:text-[#712ae2] transition-colors">Dashboard</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/organizer/events" className="hover:text-[#712ae2] transition-colors">My Events</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#712ae2] font-semibold truncate max-w-[200px]">{event?.title ?? 'Attendees'}</span>
        </div>

        {/* Event Summary Card */}
        {event && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-[20px] sm:text-[22px] font-extrabold text-[#131b2e] mb-1">{event.title}</h1>
                <div className="flex flex-wrap gap-3 text-[12px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {fmtEventDate(event.event_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {event.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">label</span>
                    {event.category}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Link
                  href="/organizer/check-in"
                  id="open-checkin-btn"
                  className="px-4 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-[#712ae2] to-[#3525cd] text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  Open Gate Check-in
                </Link>
                <Link
                  href={`/organizer/events/${eventId}/edit`}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit Event
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 min-[440px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <StatCard icon="confirmation_number" label="Total Bookings" value={stats.total_bookings} color="bg-purple-100 text-[#712ae2]" />
            <StatCard icon="check_circle" label="Confirmed" value={stats.confirmed_bookings} color="bg-emerald-100 text-emerald-700" />
            <StatCard icon="pending" label="Pending" value={stats.pending_bookings} color="bg-amber-100 text-amber-700" />
            <StatCard icon="sell" label="Tickets Sold" value={stats.tickets_sold} color="bg-blue-100 text-blue-700" />
            <StatCard icon="how_to_reg" label="Checked In" value={stats.checked_in_count} color="bg-teal-100 text-teal-700" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
              <input
                id="search-input"
                type="text"
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#712ae2] focus:ring-1 focus:ring-[#712ae2]/10 transition-all"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
          {/* Booking status */}
          <select
            id="filter-booking-status"
            className={selectCls}
            value={bookingStatus}
            onChange={handleFilterChange(setBookingStatus)}
          >
            <option value="">All Booking Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          {/* Payment status */}
          <select
            id="filter-payment-status"
            className={selectCls}
            value={paymentStatus}
            onChange={handleFilterChange(setPaymentStatus)}
          >
            <option value="">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          {/* Ticket/check-in status */}
          <select
            id="filter-ticket-status"
            className={selectCls}
            value={ticketStatus}
            onChange={handleFilterChange(setTicketStatus)}
          >
            <option value="">All Ticket Status</option>
            <option value="active">Active (Not Checked In)</option>
            <option value="used">Checked In</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Loading overlay on filter change */}
        {loading && event && (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined text-[#712ae2] text-[32px] animate-spin">progress_activity</span>
          </div>
        )}

        {/* Results */}
        {!loading && (
          <>
            {/* Count */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] text-slate-500">
                {pagination ? (
                  <>
                    Showing {pagination.from ?? 0}–{pagination.to ?? 0} of{' '}
                    <strong>{pagination.total}</strong> booking{pagination.total !== 1 ? 's' : ''}
                  </>
                ) : '—'}
              </div>
            </div>

            {/* Desktop Table */}
            {bookings.length > 0 ? (
              <>
                <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Booking</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Check-in</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <BookingRow key={b.id} booking={b} onSelect={() => setSelectedBooking(b)} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3 mb-4">
                  {bookings.map((b) => (
                    <BookingCard key={b.id} booking={b} onSelect={() => setSelectedBooking(b)} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.last_page > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      id="prev-page-btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      ← Prev
                    </button>
                    <span className="text-[12px] text-slate-500 px-2">
                      Page {pagination.current_page} of {pagination.last_page}
                    </span>
                    <button
                      id="next-page-btn"
                      disabled={page >= pagination.last_page}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-[30px] text-slate-300">people</span>
                </div>
                <h3 className="text-[15px] font-bold text-slate-700 mb-1">No bookings found</h3>
                <p className="text-[12px] text-slate-400 max-w-xs">
                  {search || bookingStatus || paymentStatus || ticketStatus
                    ? 'No bookings match your current filters. Try clearing the filters.'
                    : 'No one has booked this event yet.'}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}
