'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  getStoredAuth,
  logoutUser,
  fetchMyBookings,
  cancelBooking,
  requestRefund,
  fetchBookingTickets,
  fetchPaymentStatus,
} from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import type { AuthUser } from '@/types/auth';
import type { BookingItem, TicketItem } from '@/types/booking';

export default function MyBookingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [checkingPaymentRef, setCheckingPaymentRef] = useState<string | null>(null);

  // Tickets map by booking ID
  const [ticketsMap, setTicketsMap] = useState<Record<number, TicketItem[]>>({});
  const [loadingTicketsId, setLoadingTicketsId] = useState<number | null>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<number | null>(null);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login?redirect=/my-bookings');
      return;
    }
    setUser(authUser);
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyBookings();
      setBookings(data.bookings);

      // Populate tickets map from booking records if embedded
      const initialMap: Record<number, TicketItem[]> = {};
      data.bookings.forEach((b) => {
        if (b.tickets && b.tickets.length > 0) {
          initialMap[b.id] = b.tickets;
        }
      });
      setTicketsMap(initialMap);
    } catch {
      setError('Unable to load bookings. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  async function handleCancelReservation(bookingId: number) {
    if (!window.confirm('Are you sure you want to cancel this reservation? The reserved tickets will be returned to event stock.')) {
      return;
    }

    setCancellingId(bookingId);
    setError(null);
    setActionSuccess(null);

    try {
      const response = await cancelBooking(bookingId);
      setActionSuccess(response.message || 'Booking cancelled and tickets released.');
      // Refresh bookings
      await loadBookings();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Unable to cancel booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRequestRefund(bookingId: number) {
    if (!window.confirm('Are you sure you want to cancel this booking and request a refund? Your tickets will be invalidated and your spot will be released.')) {
      return;
    }

    setRefundingId(bookingId);
    setError(null);
    setActionSuccess(null);

    try {
      const response = await requestRefund(bookingId, 'Customer requested cancellation from My Bookings.');
      setActionSuccess(response.message || 'Refund requested successfully.');
      await loadBookings();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Unable to process refund request.');
    } finally {
      setRefundingId(null);
    }
  }

  async function handleCheckStatus(reference?: string | null) {
    if (!reference) return;
    setCheckingPaymentRef(reference);
    setError(null);
    setActionSuccess(null);

    try {
      const data = await fetchPaymentStatus(reference);
      if (data.payment.status === 'paid') {
        setActionSuccess('Payment confirmed as PAID! Your tickets are ready.');
      } else if (data.payment.status === 'failed') {
        setActionSuccess('Payment status: FAILED.');
      } else if (data.payment.status === 'cancelled') {
        setActionSuccess('Payment status: CANCELLED.');
      } else {
        setActionSuccess(`Payment status: ${data.payment.status.toUpperCase()}. If you completed transaction, allow a moment and check again.`);
      }
      await loadBookings();
    } catch {
      setError('Unable to check payment status right now.');
    } finally {
      setCheckingPaymentRef(null);
    }
  }

  async function toggleViewTickets(bookingId: number) {
    if (expandedBookingId === bookingId) {
      setExpandedBookingId(null);
      return;
    }

    // Check if tickets already loaded
    if (ticketsMap[bookingId] && ticketsMap[bookingId].length > 0) {
      setExpandedBookingId(bookingId);
      return;
    }

    // Fetch from backend
    setLoadingTicketsId(bookingId);
    try {
      const res = await fetchBookingTickets(bookingId);
      setTicketsMap((prev) => ({ ...prev, [bookingId]: res.tickets || [] }));
      setExpandedBookingId(bookingId);
    } catch {
      setError('Unable to load tickets for this booking.');
    } finally {
      setLoadingTicketsId(null);
    }
  }

  function getBookingStatusBadge(booking: BookingItem) {
    if (booking.booking_status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300">
          <span className="material-symbols-outlined text-[13px]">schedule_send</span>
          {t('status.expired')}
        </span>
      );
    }
    if (booking.booking_status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
          <span className="material-symbols-outlined text-[13px]">cancel</span>
          {t('status.cancelled')}
        </span>
      );
    }
    if (booking.payment_status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
          <span className="material-symbols-outlined text-[13px]">verified</span>
          {t('status.paid')}
        </span>
      );
    }
    if (booking.payment_method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200">
          <span className="material-symbols-outlined text-[13px]">payments</span>
          {t('customer.payAtDoor')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200">
        <span className="material-symbols-outlined text-[13px]">schedule</span>
        {t('status.pending')}
      </span>
    );
  }

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function formatPrice(price: number | string) {
    return Number(price).toLocaleString() + ' ETB';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[28px]">confirmation_number</span>
            <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          </div>
          <div className="h-9 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </header>
        <main className="max-w-4xl mx-auto w-full p-6 flex-grow">
          <div className="h-8 w-48 bg-slate-200 rounded mb-6 animate-pulse" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200 animate-pulse">
                <div className="h-5 w-48 bg-slate-200 rounded mb-3" />
                <div className="h-4 w-32 bg-slate-100 rounded mb-2" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="material-symbols-outlined text-[#3525cd] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              confirmation_number
            </span>
            <span className="text-[20px] font-extrabold text-[#131b2e] group-hover:text-[#3525cd] transition-colors">
              TiketHub
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher variant="pill" />
          <NotificationBell />
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-bold text-[#131b2e]">{user?.name}</div>
            <div className="text-[11px] text-slate-500">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full p-4 sm:p-8 flex-grow">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#131b2e]">{t('customer.myBookingsTitle')}</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">{t('customer.myBookingsSubtitle')}</p>
          </div>
          <Link
            href="/"
            className="w-fit px-4 py-2.5 rounded-xl bg-[#3525cd] text-white text-[13px] font-bold hover:bg-[#4f46e5] transition-all shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">explore</span>
            {t('customer.browseEvents')}
          </Link>
        </div>

        {/* Feedback Alerts */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] flex items-start gap-2 mb-6">
            <span className="material-symbols-outlined text-rose-600 text-sm mt-0.5 shrink-0">error</span>
            <div className="flex-1">{error}</div>
            <button onClick={loadBookings} className="text-rose-700 font-semibold hover:underline text-xs">Retry</button>
          </div>
        )}

        {/* Bookings List */}
        {bookings.length === 0 && !error ? (
          <div className="text-center py-16 px-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-[#e2dfff] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#3525cd] text-[32px]">confirmation_number</span>
            </div>
            <h2 className="text-[20px] font-bold text-[#131b2e] mb-2">{t('common.noBookingsFound')}</h2>
            <p className="text-[#464555] text-sm mb-6 max-w-md mx-auto">
              You haven&apos;t booked any events yet. Explore upcoming concerts, conferences, and festivals in Ethiopia.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3525cd] text-white font-bold text-[14px] hover:bg-[#4f46e5] transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">explore</span>
              {t('customer.browseEvents')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const isPaid = booking.payment_status === 'paid';
              const isCash = booking.payment_method === 'cash';
              const isExpired = booking.booking_status === 'expired';
              const isCancelled = booking.booking_status === 'cancelled';
              const isPendingOnline = booking.payment_status === 'pending' && !isCash && !isExpired && !isCancelled;
              const canViewTickets = (isPaid || isCash) && !isExpired && !isCancelled;
              const currentTickets = ticketsMap[booking.id] || [];

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                >
                  {/* Card Header */}
                  <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400">BOOKING #{booking.id}</span>
                        {getBookingStatusBadge(booking)}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                          {booking.payment_method}
                        </span>
                      </div>
                      <h3 className="text-[17px] font-extrabold text-[#131b2e] truncate">
                        {booking.event?.title ?? `Event #${booking.event_id}`}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-slate-500">
                        {booking.event?.location && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {booking.event.location}
                          </span>
                        )}
                        {booking.event?.event_date && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            {formatDate(booking.event.event_date)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">confirmation_number</span>
                          {booking.ticket_quantity} pass{booking.ticket_quantity > 1 ? 'es' : ''}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-[#3525cd] font-mono">
                          <span className="material-symbols-outlined text-[14px]">payments</span>
                          {formatPrice(booking.total_price)}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-start sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {isPendingOnline && (
                        <>
                          {booking.payment_reference && (
                            <button
                              onClick={() => handleCheckStatus(booking.payment_reference)}
                              disabled={checkingPaymentRef === booking.payment_reference}
                              className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[12px] font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {checkingPaymentRef === booking.payment_reference ? (
                                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                              ) : (
                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                              )}
                              {t('common.inspect')}
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelReservation(booking.id)}
                            disabled={cancellingId === booking.id}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[12px] font-bold transition-colors disabled:opacity-50"
                          >
                            {cancellingId === booking.id ? t('common.saving') : t('customer.cancelBooking')}
                          </button>
                        </>
                      )}

                      {isPaid && !isCancelled && !isExpired && (
                        <button
                          onClick={() => handleRequestRefund(booking.id)}
                          disabled={refundingId === booking.id}
                          className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-[12px] font-bold transition-colors disabled:opacity-50"
                        >
                          {refundingId === booking.id ? t('common.saving') : t('customer.requestRefund')}
                        </button>
                      )}

                      {canViewTickets && (
                        <button
                          onClick={() => toggleViewTickets(booking.id)}
                          disabled={loadingTicketsId === booking.id}
                          className="px-3.5 py-1.5 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white text-[12px] font-bold transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                        >
                          {loadingTicketsId === booking.id ? (
                            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                          )}
                          {expandedBookingId === booking.id ? t('common.close') : t('customer.viewQrCode')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expiry Warning for Pending Digital Payments */}
                  {isPendingOnline && booking.expires_at && (
                    <div className="px-5 pb-4">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] text-amber-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">schedule</span>
                        <span>
                          Reservation expires at: <strong>{new Date(booking.expires_at).toLocaleString()}</strong>.
                          {' '}Complete payment before this time to avoid inventory release.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expired Notice */}
                  {isExpired && (
                    <div className="px-5 pb-4">
                      <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[12px] text-slate-600 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-slate-500 shrink-0">info</span>
                        <span>
                          This reservation expired because payment was not completed within the time limit. Reserved tickets were released back to stock.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Cash Notice */}
                  {isCash && !isCancelled && !isExpired && (
                    <div className="px-5 pb-4">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600 shrink-0">payments</span>
                        <span>
                          <strong>Pay at Door:</strong> Present your ticket QR code at the venue gate and pay cash upon entrance.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expanded Tickets Section */}
                  {expandedBookingId === booking.id && (
                    <div className="border-t border-slate-100 p-5 bg-[#faf8ff] space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-[#131b2e] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-[#3525cd]">confirmation_number</span>
                          Issued Tickets ({currentTickets.length})
                        </span>
                      </div>

                      {currentTickets.length === 0 ? (
                        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                          No tickets found for this booking.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentTickets.map((ticket) => (
                            <TicketCard
                              key={ticket.id}
                              ticket={ticket}
                              eventTitle={booking.event?.title}
                              eventDate={booking.event?.event_date}
                              eventLocation={booking.event?.location}
                              totalTickets={booking.ticket_quantity}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Ticket Card Component ───────────────────────────────────────────────────

interface TicketCardProps {
  ticket: TicketItem;
  eventTitle?: string;
  eventDate?: string;
  eventLocation?: string;
  totalTickets: number;
}

function TicketCard({ ticket, eventTitle, eventDate, eventLocation, totalTickets }: TicketCardProps) {
  const [showQr, setShowQr] = useState(true);

  const statusBadge = ticket.status === 'active'
    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
    : ticket.status === 'used'
    ? 'text-slate-600 bg-slate-100 border border-slate-200'
    : 'text-rose-700 bg-rose-50 border border-rose-200';

  return (
    <div className="bg-white rounded-2xl border border-[#c7c4d8]/40 overflow-hidden shadow-xs flex flex-col">
      {/* Ticket Header */}
      <div className="p-4 bg-gradient-to-r from-[#3525cd]/5 to-[#712ae2]/5 border-b border-[#c7c4d8]/20 flex items-center justify-between">
        <div>
          <span className="text-[12px] font-mono font-bold text-[#3525cd]">{ticket.ticket_identifier}</span>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Seat #{ticket.seat_number} of {totalTickets}
          </div>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadge}`}>
          {ticket.status}
        </span>
      </div>

      {/* QR Code Container */}
      <div className="p-5 flex flex-col items-center gap-3 flex-grow justify-center bg-white">
        {showQr && (
          <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200">
            {/* Render QR code via secure opaque ticket token (contains zero sensitive PII/payment data) */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(ticket.ticket_token)}&bgcolor=ffffff&color=131b2e&margin=6`}
              alt={`QR for ${ticket.ticket_identifier}`}
              className="w-36 h-36 rounded-lg"
              loading="lazy"
            />
          </div>
        )}

        <div className="text-center w-full">
          <p className="text-[12px] font-extrabold text-[#131b2e] truncate">{eventTitle}</p>
          {eventDate && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              {new Date(eventDate).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
          {eventLocation && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{eventLocation}</p>
          )}
        </div>

        {ticket.checked_in_at && (
          <div className="w-full px-3 py-1.5 rounded-lg bg-slate-100 text-[10px] text-slate-600 text-center font-medium">
            ✓ Checked in: {new Date(ticket.checked_in_at).toLocaleString()}
          </div>
        )}
      </div>

      {/* Ticket Footer */}
      <div className="p-3 bg-[#faf8ff] border-t border-[#c7c4d8]/20 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-mono text-[10px]">64-bit Secure Token</span>
        <button
          onClick={() => setShowQr(!showQr)}
          className="text-[#3525cd] font-bold hover:underline"
        >
          {showQr ? 'Collapse' : 'Expand QR'}
        </button>
      </div>
    </div>
  );
}
