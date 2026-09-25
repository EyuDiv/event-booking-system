'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  fetchEventById,
  createBooking,
  initiatePayment,
  fetchPaymentStatus,
  verifyPayment,
  fetchBookingTickets,
  getStoredAuth,
  logoutUser,
} from '@/lib/api';
import type { EventItem } from '@/types/event';
import type { BookingItem, PaymentItem, PaymentState, TicketItem } from '@/types/booking';
import type { AuthUser, ApiError } from '@/types/auth';

interface Props {
  eventId: string;
}

export default function EventDetailsClient({ eventId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  // Authentication State
  const [user, setUser] = useState<AuthUser | null>(null);

  // Event Data State
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Booking Form & Payment Lifecycle State
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'telebirr' | 'cbe' | 'cash'>('telebirr');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<BookingItem | null>(null);
  const [successPayment, setSuccessPayment] = useState<PaymentItem | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [bookingTickets, setBookingTickets] = useState<TicketItem[]>([]);
  const [verifyingStatus, setVerifyingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-polling for pending digital payments (Telebirr / CBE)
  useEffect(() => {
    if (!successBooking || !successPayment?.reference) return;
    if (paymentState !== 'pending' && paymentState !== 'initiating') return;
    if (successBooking.payment_method === 'cash') return;

    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 15; // 15 polls * 3.5s = ~52.5s safe limit

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        return;
      }

      try {
        const data = await fetchPaymentStatus(successPayment.reference);
        if (!isMounted) return;

        const updatedPayment = data.payment;
        setSuccessPayment(updatedPayment);

        if (updatedPayment.status === 'paid') {
          clearInterval(interval);
          setPaymentState('paid');
          setSuccessBooking((prev) =>
            prev ? { ...prev, payment_status: 'paid', booking_status: 'confirmed' } : null
          );
          try {
            const ticketData = await fetchBookingTickets(successBooking.id);
            if (isMounted) setBookingTickets(ticketData.tickets || []);
          } catch {
            // ignore
          }
        } else if (updatedPayment.status === 'failed') {
          clearInterval(interval);
          setPaymentState('failed');
        } else if (updatedPayment.status === 'cancelled') {
          clearInterval(interval);
          setPaymentState('cancelled');
        }
      } catch {
        // ignore network glitches during polling
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [successBooking?.id, successPayment?.reference, paymentState]);

  // Load auth user on client mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const { user: authUser } = getStoredAuth();
      setUser(authUser);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Event from MySQL backend
  useEffect(() => {
    let isMounted = true;

    async function loadEvent() {
      setLoading(true);
      setError(null);
      setNotFound(false);

      try {
        const data = await fetchEventById(eventId);
        if (isMounted) {
          setEvent(data.event);
          // Set sensible initial quantity
          if (data.event.available_tickets > 0) {
            setQuantity(1);
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 404) {
          setNotFound(true);
        } else {
          setError(apiErr.message || 'Unable to load event details. Please try again.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Derived Calculations
  const isSoldOut = useMemo(() => {
    if (!event) return false;
    return event.status === 'sold_out' || event.available_tickets <= 0;
  }, [event]);

  const maxQuantity = useMemo(() => {
    if (!event) return 1;
    // Allow up to 6 tickets or whatever is left in stock
    return Math.max(1, Math.min(event.available_tickets, 6));
  }, [event]);

  const unitPrice = useMemo(() => {
    if (!event) return 0;
    const p = typeof event.ticket_price === 'string' ? parseFloat(event.ticket_price) : event.ticket_price;
    return Number.isNaN(p) ? 0 : p;
  }, [event]);

  const totalAmount = useMemo(() => {
    return unitPrice * quantity;
  }, [unitPrice, quantity]);

  const approxUsd = useMemo(() => {
    // Current approximate ETB to USD conversion (~120 ETB = 1 USD)
    const usd = unitPrice / 120;
    return usd.toFixed(2);
  }, [unitPrice]);

  // Handle Stepper
  function handleDecrement() {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  }

  function handleIncrement() {
    if (quantity < maxQuantity) {
      setQuantity((prev) => prev + 1);
    }
  }

  // Handle Copy Link
  function handleCopyShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  // Handle Booking Submission + Payment Initiation
  async function handleBookingSubmit() {
    if (submitting || isSoldOut || !event) return;

    setBookingError(null);
    setStatusMessage(null);
    setBookingTickets([]);

    // 1. Check Authentication
    const { token, user: currentUser } = getStoredAuth();
    if (!token || !currentUser) {
      router.push(`/login?redirect=/events/${event.id}`);
      return;
    }

    if (currentUser.role !== 'customer') {
      setBookingError('Only customer accounts can book tickets. Please sign in as a customer.');
      return;
    }

    // 2. Validate bounds
    if (quantity < 1) {
      setBookingError('Please select at least 1 ticket.');
      return;
    }

    if (quantity > event.available_tickets) {
      setBookingError(`Only ${event.available_tickets} ticket(s) remain available.`);
      return;
    }

    setSubmitting(true);
    setPaymentState('initiating');

    try {
      // Step 1: Create booking (pending state)
      const bookingResponse = await createBooking({
        event_id: event.id,
        ticket_quantity: quantity,
        payment_method: paymentMethod,
      });

      const newBooking = bookingResponse.booking;
      setSuccessBooking(newBooking);

      // Update local event stock seamlessly
      setEvent((prev) => {
        if (!prev) return null;
        const newAvailable = Math.max(0, prev.available_tickets - quantity);
        return {
          ...prev,
          available_tickets: newAvailable,
          status: newAvailable === 0 ? 'sold_out' : prev.status,
        };
      });

      // Step 2: Initiate payment with backend (authoritative calculation)
      try {
        const paymentResponse = await initiatePayment(newBooking.id);
        const payment = paymentResponse.payment;
        setSuccessPayment(payment);

        if (paymentMethod === 'cash') {
          // Pay at door: load provisionally issued tickets immediately
          setPaymentState('pending');
          try {
            const ticketData = await fetchBookingTickets(newBooking.id);
            setBookingTickets(ticketData.tickets || []);
          } catch {
            // ignore
          }
        } else if (payment.status === 'paid') {
          // Online paid
          setPaymentState('paid');
          try {
            const ticketData = await fetchBookingTickets(newBooking.id);
            setBookingTickets(ticketData.tickets || []);
          } catch {
            // ignore
          }
        } else if (payment.requires_redirect && payment.checkout_url) {
          // Redirect to provider checkout
          setPaymentState('redirecting');
          window.location.href = payment.checkout_url;
          return;
        } else {
          setPaymentState('pending');
        }
      } catch (payErr: unknown) {
        const payApiErr = payErr as ApiError;
        setSuccessPayment(null);
        if (payApiErr.status === 503) {
          // Provider unconfigured (waiting for merchant credentials)
          setPaymentState('pending');
        } else {
          setPaymentState('failed');
          setBookingError(
            payApiErr.message || 'Booking created but payment initiation failed. Please try again from My Bookings.'
          );
        }
      }

    } catch (err: unknown) {
      setPaymentState('idle');
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        router.push(`/login?redirect=/events/${event.id}`);
      } else if (apiErr.status === 403) {
        setBookingError(apiErr.message || 'Only customer accounts can book tickets.');
      } else if (apiErr.status === 422) {
        const validationMsg = apiErr.errors
          ? Object.values(apiErr.errors).flat().join(' ')
          : apiErr.message;
        setBookingError(validationMsg || 'Booking could not be processed. Ticket availability may have changed.');
        try {
          const fresh = await fetchEventById(eventId);
          setEvent(fresh.event);
        } catch {
          // ignore
        }
      } else {
        setBookingError(apiErr.message || 'Unable to complete your booking. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Manual Status Verification
  async function handleCheckStatus() {
    if (!successPayment?.reference || !successBooking) return;
    setVerifyingStatus(true);
    setStatusMessage(null);
    try {
      const data = await verifyPayment(successPayment.reference);
      setSuccessPayment(data.payment);
      if (data.payment.status === 'paid') {
        setPaymentState('paid');
        setSuccessBooking((prev) =>
          prev ? { ...prev, payment_status: 'paid', booking_status: 'confirmed' } : null
        );
        try {
          const ticketData = await fetchBookingTickets(successBooking.id);
          setBookingTickets(ticketData.tickets || []);
        } catch {}
        setStatusMessage('Payment confirmed! Your tickets are ready.');
      } else if (data.payment.status === 'failed') {
        setPaymentState('failed');
        setStatusMessage('Payment failed or was declined.');
      } else {
        setStatusMessage('Payment is still pending. If you completed payment, please allow a moment and check again.');
      }
    } catch {
      setStatusMessage('Unable to check payment status right now. You can check again from My Bookings.');
    } finally {
      setVerifyingStatus(false);
    }
  }

  // Format Helper
  function formatEventDate(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatEventTime(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getMonthDay(dateString?: string) {
    if (!dateString) return { month: 'NOV', day: '15' };
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return { month: 'EVT', day: '01' };
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = date.getDate().toString();
    return { month, day };
  }

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans">
        {/* Header */}
        <header className="bg-white sticky top-0 z-40 border-b border-[#c7c4d8]/30 shadow-sm h-16 flex items-center px-4 sm:px-6">
          <div className="max-w-[80rem] mx-auto w-full flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#4f46e5]/20 animate-pulse" />
              <span className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="h-9 w-24 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </header>

        {/* Content Skeleton */}
        <main className="flex-1 max-w-[80rem] mx-auto w-full px-4 sm:px-6 py-6">
          <div className="h-5 w-48 bg-slate-200 rounded mb-6 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="aspect-[16/9] w-full rounded-2xl bg-slate-200 animate-pulse" />
              <div className="h-32 rounded-2xl bg-white p-6 border border-[#c7c4d8]/30 shadow-sm animate-pulse flex flex-col gap-3">
                <div className="h-6 w-3/4 bg-slate-200 rounded" />
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="h-96 rounded-2xl bg-white p-6 border border-[#c7c4d8]/30 shadow-sm animate-pulse flex flex-col gap-4">
                <div className="h-8 w-1/3 bg-slate-200 rounded" />
                <div className="h-10 w-full bg-slate-200 rounded" />
                <div className="h-20 w-full bg-slate-200 rounded" />
                <div className="h-12 w-full bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Event Not Found State
  if (notFound || !event) {
    return (
      <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans">
        <header className="bg-white border-b border-[#c7c4d8]/30 shadow-sm">
          <div className="max-w-[80rem] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-[22px] font-extrabold text-[#3525cd]">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                confirmation_number
              </span>
              <span>TiketHub</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 flex items-center justify-center py-16">
          <div className="bg-white border border-[#c7c4d8]/40 rounded-2xl p-8 text-center shadow-sm w-full">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">event_busy</span>
            </div>
            <h1 className="text-[24px] font-bold text-[#131b2e]">Event Not Found</h1>
            <p className="text-[14px] text-[#464555] mt-2">
              The event you are looking for does not exist, has been removed, or is currently unpublished.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3525cd] text-white text-[14px] font-semibold hover:bg-[#4f46e5] transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Discover Other Events</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Generic Loading Error State
  if (error) {
    return (
      <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans">
        <header className="bg-white border-b border-[#c7c4d8]/30 shadow-sm">
          <div className="max-w-[80rem] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-[22px] font-extrabold text-[#3525cd]">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                confirmation_number
              </span>
              <span>TiketHub</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 flex items-center justify-center py-16">
          <div className="bg-white border border-[#c7c4d8]/40 rounded-2xl p-8 text-center shadow-sm w-full">
            <span className="material-symbols-outlined text-amber-600 text-[40px]">warning</span>
            <h1 className="text-[20px] font-bold text-[#131b2e] mt-3">Unable to Load Event</h1>
            <p className="text-[14px] text-[#464555] mt-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-5 py-2.5 rounded-xl bg-[#3525cd] text-white text-[14px] font-semibold hover:bg-[#4f46e5] transition-all shadow-sm"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { month, day } = getMonthDay(event.event_date);
  const formattedDate = formatEventDate(event.event_date);
  const formattedTime = formatEventTime(event.event_date);
  const organizerName = event.organizer?.name || 'TiketHub Verified Host';

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans selection:bg-[#4f46e5] selection:text-white">
      {/* TopNavBar (Matching Stitch and TiketHub header) */}
      <header className="bg-white sticky top-0 z-40 border-b border-[#c7c4d8]/30 shadow-sm">
        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 flex justify-between items-center h-16 w-full gap-4">
          {/* Brand & Main Nav Links */}
          <div className="flex items-center gap-6 md:gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-[22px] font-extrabold text-[#3525cd] tracking-tight hover:opacity-90 transition-opacity"
            >
              <span
                className="material-symbols-outlined text-[#3525cd] text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                confirmation_number
              </span>
              <span>TiketHub</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-[#3525cd] font-bold border-b-2 border-[#3525cd] pb-1 text-[15px]"
              >
                {t('nav.discover')}
              </Link>
              <Link
                href={user ? '/dashboard' : '/login'}
                className="text-[#464555] font-medium hover:text-[#3525cd] text-[15px] transition-colors"
              >
                {t('nav.myBookings')}
              </Link>
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : user?.role === 'super-admin'
                    ? '/admin'
                    : '/my-bookings'
                }
                className="text-[#464555] font-medium hover:text-[#3525cd] text-[15px] transition-colors"
              >
                {t('nav.organizerHub')}
              </Link>
            </nav>
          </div>

          {/* Right: Auth State / Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher variant="pill" />

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-[13px] text-[#464555]">
                  Hi, <strong className="text-[#131b2e]">{user.name}</strong>
                </span>
                <button
                  onClick={async () => {
                    await logoutUser();
                    setUser(null);
                    router.refresh();
                  }}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-[#c7c4d8]/40 hover:bg-[#f2f3ff] text-[13px] font-semibold text-[#464555] transition-colors"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href={`/login?redirect=/events/${event.id}`}
                  className="px-3.5 py-1.5 rounded-lg hover:bg-[#f2f3ff] text-[13px] font-semibold text-[#131b2e] transition-colors"
                >
                  {t('nav.signIn')}
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl bg-[#3525cd] hover:bg-[#4f46e5] text-white text-[13px] font-semibold transition-all shadow-sm"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-4 shadow-lg animate-fadeIn">
            <nav className="flex flex-col gap-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-[#3525cd] bg-[#f2f3ff] text-[14px]"
              >
                <span className="material-symbols-outlined text-[20px]">explore</span>
                {t('nav.discover')}
              </Link>
              <Link
                href={user ? '/dashboard' : '/login'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-50 text-[14px] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-slate-400">confirmation_number</span>
                {t('nav.myBookings')}
              </Link>
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : user?.role === 'super-admin'
                    ? '/admin'
                    : '/my-bookings'
                }
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-50 text-[14px] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-slate-400">hub</span>
                {t('nav.organizerHub')}
              </Link>

              {user ? (
                <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Signed in as <strong className="text-slate-800">{user.name}</strong> ({user.role})</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await logoutUser();
                      setUser(null);
                      router.refresh();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 font-semibold text-sm hover:bg-rose-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : (
                <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <Link
                    href={`/login?redirect=/events/${event.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 font-semibold text-sm text-slate-800 hover:bg-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">login</span>
                    <span>{t('nav.signIn')}</span>
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3525cd] font-semibold text-sm text-white hover:bg-[#3525cd]/90 shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>{t('nav.register')}</span>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[80rem] mx-auto w-full px-4 sm:px-6 py-6">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[13px] text-[#464555]">
          <Link href="/" className="hover:text-[#3525cd] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">home</span>
            <span>Home</span>
          </Link>
          <span className="text-[#c7c4d8]">/</span>
          <span className="hover:text-[#3525cd] cursor-pointer">{event.category}</span>
          <span className="text-[#c7c4d8]">/</span>
          <span className="text-[#3525cd] font-bold truncate max-w-xs md:max-w-md">{event.title}</span>
        </nav>

        {/* Two-Column Layout (Desktop: 65% / 35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Main Event Details (approx 65% / 8 columns) */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            {/* Cover Image Frame */}
            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-[#c7c4d8]/30 shadow-sm group bg-[#eaedff]">
              {event.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.image_url}
                  alt={event.title}
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${
                    isSoldOut ? 'grayscale-[25%]' : ''
                  }`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#4f46e5] to-[#712ae2] text-white">
                  <span className="material-symbols-outlined text-[64px]">confirmation_number</span>
                  <span className="text-[16px] font-bold mt-2">{event.category}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/25 pointer-events-none" />

              {/* Category & Status Floating Badges */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-[calc(100%-5.5rem)]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[#3525cd] text-[12px] sm:text-[13px] font-bold shadow-md">
                  <span className="material-symbols-outlined text-[15px] sm:text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    confirmation_number
                  </span>
                  <span>{event.category}</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#712ae2] text-white text-[12px] font-semibold shadow-md">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  <span>Featured Experience</span>
                </span>
              </div>

              {/* Quick Share & Bookmark Floating Pills */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Share Event"
                  onClick={handleCopyShare}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white text-[#131b2e] backdrop-blur-md flex items-center justify-center shadow-md transition-transform active:scale-95"
                  title={copiedLink ? 'Link copied!' : 'Share Event'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {copiedLink ? 'check' : 'share'}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Bookmark Event"
                  onClick={() => setIsBookmarked((prev) => !prev)}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-white backdrop-blur-md flex items-center justify-center shadow-md transition-transform active:scale-95 ${
                    isBookmarked ? 'text-rose-600' : 'text-[#131b2e]'
                  }`}
                  title={isBookmarked ? 'Saved' : 'Save Event'}
                >
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                </button>
              </div>

              {/* Bottom Image Overlay Micro-meta */}
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 text-white">
                <div className="flex items-center gap-2 text-xs font-medium bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full w-fit">
                  <span className="material-symbols-outlined text-sm text-[#4edea3]">verified</span>
                  <span>Official Addis Festival Circuit</span>
                </div>
                <span className="text-xs bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full font-mono w-fit">
                  Capacity: {event.total_tickets.toLocaleString()} attendees
                </span>
              </div>
            </div>

            {/* Event Title & Organizer Card */}
            <div className="flex flex-col gap-3 bg-white rounded-2xl p-6 border border-[#c7c4d8]/30 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#3525cd] tracking-wider uppercase">
                  Annual Landmark Experience
                </span>
                {isSoldOut ? (
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Sold Out</span>
                  </div>
                ) : event.available_tickets <= 20 ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>High Demand Event</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Tickets Available</span>
                  </div>
                )}
              </div>

              <h1 className="text-[26px] sm:text-[34px] font-extrabold text-[#131b2e] tracking-tight leading-tight">
                {event.title}
              </h1>

              {/* Organizer Info Row */}
              <div className="pt-3 border-t border-[#c7c4d8]/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#712ae2] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                    {organizerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[16px] font-bold text-[#131b2e]">{organizerName}</span>
                      <span
                        className="material-symbols-outlined text-[#3525cd] text-base"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        title="Verified Organizer"
                      >
                        verified
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-[#464555]">
                      <span className="inline-flex items-center gap-1 text-[#005338] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#005338]" />
                        Verified Host
                      </span>
                      <span>•</span>
                      <span>Verified Event Partner</span>
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:${event.organizer?.email || 'events@tikethub.com'}?subject=Inquiry regarding ${encodeURIComponent(event.title)}`}
                  className="inline-flex items-center gap-1.5 text-[#3525cd] hover:text-[#4f46e5] text-[13px] font-semibold border border-[#3525cd]/20 px-3.5 py-2 rounded-xl hover:bg-[#e2dfff]/30 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">mail</span>
                  <span>Contact Organizer</span>
                </a>
              </div>
            </div>

            {/* Key Metadata Bento Card: Date & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date & Time Card */}
              <div className="p-5 rounded-2xl bg-white border border-[#c7c4d8]/30 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#3525cd]/10 text-[#3525cd] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold uppercase leading-none">{month}</span>
                  <span className="text-[18px] font-extrabold leading-tight">{day}</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
                    Date &amp; Time
                  </span>
                  <p className="text-[16px] font-bold text-[#131b2e] truncate">{formattedDate}</p>
                  <p className="text-[13px] text-[#464555] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#777587]">schedule</span>
                    <span>{formattedTime || 'Doors open 3:30 PM EAT'}</span>
                  </p>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&location=${encodeURIComponent(event.location)}&details=${encodeURIComponent(event.description || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 text-[12px] text-[#3525cd] font-semibold hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Add to Google Calendar</span>
                    <span className="material-symbols-outlined text-xs">north_east</span>
                  </a>
                </div>
              </div>

              {/* Location & Interactive Pin Card */}
              <div className="p-5 rounded-2xl bg-white border border-[#c7c4d8]/30 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#712ae2]/10 text-[#712ae2] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    location_on
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-[11px] text-[#464555] uppercase tracking-wider font-semibold">
                    Venue Location
                  </span>
                  <p className="text-[16px] font-bold text-[#131b2e] truncate">{event.location}</p>
                  <p className="text-[13px] text-[#464555] line-clamp-1" title={event.location}>
                    Addis Ababa, Ethiopia
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-[#3525cd] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">directions</span>
                      <span>Get Directions</span>
                    </a>
                    <span className="text-[#c7c4d8]">•</span>
                    <span className="text-[12px] text-[#464555]">Gate 1 &amp; 2 Entry</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mini Venue Map Preview Card */}
            <div className="relative rounded-2xl overflow-hidden border border-[#c7c4d8]/30 shadow-sm bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3525cd] text-sm">map</span>
                  <span className="text-[14px] font-bold text-[#131b2e]">Venue Map &amp; Parking Zone</span>
                </div>
                <span className="text-xs text-[#464555]">{event.location}</span>
              </div>
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-[#c7c4d8]/20 bg-slate-100 flex items-center justify-center">
                {/* Visual architectural stylized map placeholder matching Stitch */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-200 via-indigo-50 to-purple-50 opacity-90" />
                <div className="relative z-10 flex flex-col items-center gap-1 text-center p-4">
                  <span className="material-symbols-outlined text-[#3525cd] text-2xl">pin_drop</span>
                  <span className="text-xs font-bold text-[#131b2e]">{event.location}</span>
                  <span className="text-[11px] text-[#464555]">Main Ingress &amp; VIP Security Zone</span>
                </div>
                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold text-[#131b2e] shadow flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-[#3525cd]">local_parking</span>
                  <span>Valet &amp; Free Secure Parking Available</span>
                </div>
              </div>
            </div>

            {/* Detailed Event Description ('About this Event') */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c7c4d8]/30 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#c7c4d8]/20 pb-3">
                <h2 className="text-[20px] font-bold text-[#131b2e]">About this Event</h2>
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[#eaedff] text-[#3525cd]">
                  Official Event Program
                </span>
              </div>

              <p className="text-[15px] text-[#464555] leading-relaxed">
                {event.description ||
                  'Join us for this premier event featuring groundbreaking performances, vibrant community interactions, and state-of-the-art production. Secure your tickets now to guarantee admission.'}
              </p>

              {/* Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
                <div className="p-4 rounded-xl bg-[#faf8ff] border border-[#c7c4d8]/30 flex flex-col gap-1">
                  <span className="material-symbols-outlined text-[#3525cd] text-2xl">speaker_group</span>
                  <h3 className="font-bold text-[15px] text-[#131b2e]">Spatial Audio</h3>
                  <p className="text-[12px] text-[#464555]">State-of-the-art immersive acoustics and sound engineering.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf8ff] border border-[#c7c4d8]/30 flex flex-col gap-1">
                  <span className="material-symbols-outlined text-[#712ae2] text-2xl">celebration</span>
                  <h3 className="font-bold text-[15px] text-[#131b2e]">Live Production</h3>
                  <p className="text-[12px] text-[#464555]">World-class stage lighting, visuals, and sensory experience.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#faf8ff] border border-[#c7c4d8]/30 flex flex-col gap-1">
                  <span className="material-symbols-outlined text-[#006e4b] text-2xl">local_bar</span>
                  <h3 className="font-bold text-[15px] text-[#131b2e]">Artisan Lounge</h3>
                  <p className="text-[12px] text-[#464555]">Ethiopian gourmet refreshments, specialty coffee, and networking.</p>
                </div>
              </div>

              {/* Guidelines and What to Bring */}
              <div className="mt-2 pt-4 border-t border-[#c7c4d8]/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[14px] font-bold text-[#131b2e] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#3525cd] text-base">verified_user</span>
                    <span>Security &amp; Entry Guidelines</span>
                  </h4>
                  <ul className="text-[13px] text-[#464555] space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Valid Government ID or Passport mandatory for check-in.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Digital QR ticket pass on mobile or printed copy accepted.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Security checks conducted at turnstile entrances.</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-[#131b2e] mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#3525cd] text-base">payments</span>
                    <span>Payment &amp; Ticketing</span>
                  </h4>
                  <ul className="text-[13px] text-[#464555] space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Support for telebirr, Chapa, and Cash payment.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Authoritative booking record saved directly to MySQL.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-xs text-[#3525cd]">check_circle</span>
                      <span>Truthful booking status confirmation immediately available.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Policy Badges Strip */}
              <div className="mt-2 pt-4 border-t border-[#c7c4d8]/20 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#faf8ff] border border-[#c7c4d8]/30 text-[12px] text-[#131b2e]">
                  <span className="material-symbols-outlined text-sm text-[#005338]">currency_exchange</span>
                  <span>Refund Policy: Full refund up to 7 days before event</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#faf8ff] border border-[#c7c4d8]/30 text-[12px] text-[#131b2e]">
                  <span className="material-symbols-outlined text-sm text-[#3525cd]">qr_code_scanner</span>
                  <span>Instant Mobile Ticket Delivery</span>
                </span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Sticky Ticket Booking Box (approx 35% / 4 columns) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20">
            <div className="rounded-2xl bg-white border border-[#c7c4d8]/30 p-6 shadow-lg flex flex-col gap-4">
              {/* Price Header */}
              <div className="flex items-baseline justify-between border-b border-[#c7c4d8]/20 pb-3">
                <div>
                  <span className="text-[12px] text-[#464555] font-medium">{t('customer.selectTickets')}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] font-extrabold text-[#131b2e]">
                      {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ETB
                    </span>
                    <span className="text-[13px] text-[#464555] font-medium">/ {t('common.tickets')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-[#777587]">approx. ${approxUsd} USD</span>
                </div>
              </div>

              {/* Ticket Availability Warning / Status Banner */}
              {isSoldOut ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <span className="material-symbols-outlined text-rose-600 text-lg shrink-0">cancel</span>
                  <span className="text-[13px] font-bold">{t('customer.soldOut')}</span>
                </div>
              ) : event.available_tickets <= 20 ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">bolt</span>
                  <span className="text-[13px] font-bold">
                    ⚡ {t('customer.sellingFast')} ({event.available_tickets} {t('customer.ticketsLeft')})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
                  <span className="text-[13px] font-bold">
                    ✓ {event.available_tickets} {t('customer.available')}
                  </span>
                </div>
              )}

              {/* Ticket Quantity Selector */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="quantity-input" className="text-[13px] font-bold text-[#131b2e]">
                    {t('common.quantity')}
                  </label>
                  <span className="text-xs text-[#464555]">
                    {isSoldOut ? t('customer.soldOut') : `Max ${maxQuantity}`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-[#faf8ff] border border-[#c7c4d8]/30">
                  <div className="flex items-center gap-2 pl-2">
                    <span className="material-symbols-outlined text-[#3525cd] text-xl">confirmation_number</span>
                    <span className="text-[16px] font-bold text-[#131b2e]">
                      {quantity} {t('common.tickets')}
                    </span>
                  </div>

                  {/* Stepper Capsule Control */}
                  <div className="flex items-center bg-[#eaedff] rounded-lg p-1 border border-[#c7c4d8]/30">
                    <button
                      type="button"
                      aria-label="Decrease ticket quantity"
                      onClick={handleDecrement}
                      disabled={quantity <= 1 || isSoldOut || submitting}
                      className="w-8 h-8 rounded-md bg-white hover:bg-[#faf8ff] text-[#131b2e] flex items-center justify-center font-bold shadow-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <input
                      id="quantity-input"
                      type="text"
                      readOnly
                      value={quantity}
                      className="w-10 text-center font-mono font-bold bg-transparent border-0 focus:ring-0 text-[#131b2e] p-0 text-sm"
                    />
                    <button
                      type="button"
                      aria-label="Increase ticket quantity"
                      onClick={handleIncrement}
                      disabled={quantity >= maxQuantity || isSoldOut || submitting}
                      className="w-8 h-8 rounded-md bg-white hover:bg-[#faf8ff] text-[#131b2e] flex items-center justify-center font-bold shadow-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time Price Calculation Breakdown */}
              <div className="rounded-xl bg-[#f2f3ff] p-3.5 border border-[#c7c4d8]/20 flex flex-col gap-2 font-mono">
                <div className="flex justify-between items-center text-[13px] text-[#464555]">
                  <span>
                    {t('common.price')} ({unitPrice.toLocaleString()} ETB × {quantity})
                  </span>
                  <span className="font-semibold text-[#131b2e]">{totalAmount.toLocaleString()} ETB</span>
                </div>
                <div className="h-px bg-[#c7c4d8]/30 my-1" />
                <div className="flex justify-between items-baseline">
                  <span className="text-[15px] font-bold text-[#131b2e] font-sans">{t('common.total')}</span>
                  <span className="text-[20px] font-extrabold text-[#3525cd]">
                    {totalAmount.toLocaleString()} ETB
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-[#131b2e] flex items-center justify-between">
                  <span>{t('customer.paymentMethod')}</span>
                  <span className="text-xs text-[#006e4b] font-medium flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">lock</span> 100% Secure
                  </span>
                </label>

                <div className="space-y-2">
                  {/* telebirr */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === 'telebirr'
                        ? 'border-[#3525cd] bg-[#e2dfff]/20'
                        : 'border-[#c7c4d8]/40 bg-white hover:border-[#3525cd]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment_method"
                        value="telebirr"
                        checked={paymentMethod === 'telebirr'}
                        onChange={() => setPaymentMethod('telebirr')}
                        disabled={isSoldOut || submitting}
                        className="w-4 h-4 text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-[#131b2e]">telebirr</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#3525cd] text-white tracking-wider">
                            POPULAR
                          </span>
                        </div>
                        <span className="text-xs text-[#464555]">{t('customer.telebirrDesc')}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#c7c4d8]/40 flex items-center justify-center font-bold text-xs text-[#3525cd] font-mono">
                      TB
                    </div>
                  </label>

                  {/* CBE */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'cbe'
                        ? 'border-2 border-[#3525cd] bg-[#e2dfff]/20'
                        : 'border-[#c7c4d8]/40 bg-white hover:border-[#3525cd]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment_method"
                        value="cbe"
                        checked={paymentMethod === 'cbe'}
                        onChange={() => setPaymentMethod('cbe')}
                        disabled={isSoldOut || submitting}
                        className="w-4 h-4 text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                      />
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-[#131b2e]">CBE Birr</span>
                        <span className="text-xs text-[#464555]">{t('customer.cbeDesc')}</span>
                      </div>
                    </div>
                    <div className="flex items-center -space-x-1">
                      <span className="w-6 h-6 rounded-full bg-[#eaedff] border border-[#c7c4d8]/40 flex items-center justify-center text-[8px] font-bold text-[#3525cd]">
                        CBE
                      </span>
                    </div>
                  </label>

                  {/* Cash on Venue */}
                  <label
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-2 border-[#3525cd] bg-[#e2dfff]/20'
                        : 'border-[#c7c4d8]/40 bg-white hover:border-[#3525cd]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment_method"
                        value="cash"
                        checked={paymentMethod === 'cash'}
                        onChange={() => setPaymentMethod('cash')}
                        disabled={isSoldOut || submitting}
                        className="w-4 h-4 text-[#3525cd] focus:ring-[#3525cd] border-[#c7c4d8]"
                      />
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-[#131b2e]">{t('customer.payAtDoor')}</span>
                        <span className="text-xs text-[#464555]">{t('customer.cashDesc')}</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[#777587] text-xl">payments</span>
                  </label>
                </div>
              </div>

              {/* Error Alert Display */}
              {bookingError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] flex items-start gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-sm mt-0.5 shrink-0">error</span>
                  <div className="flex-1">{bookingError}</div>
                </div>
              )}

              {/* Primary Call to Action Button */}
              <button
                type="button"
                id="btn-submit-booking"
                onClick={handleBookingSubmit}
                disabled={isSoldOut || submitting}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#3525cd] to-[#712ae2] hover:opacity-95 text-white font-bold text-[15px] shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    <span>{t('customer.processingPayment')}</span>
                  </>
                ) : isSoldOut ? (
                  <>
                    <span className="material-symbols-outlined text-lg">event_busy</span>
                    <span>{t('customer.soldOut')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">lock</span>
                    <span>{t('customer.bookNow')} • ({totalAmount.toLocaleString()} ETB)</span>
                  </>
                )}
              </button>

              {/* Trust & Reassurance Points */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#c7c4d8]/20 text-xs text-[#464555]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#006e4b]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    sms
                  </span>
                  <span>Instant SMS ticket code &amp; digital confirmation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#3525cd]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    security
                  </span>
                  <span>100% Buyer Guarantee &amp; Secure 256-bit encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#777587]">autorenew</span>
                  <span>Easily transfer or reassign ticket anytime</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer (Matching TiketHub Shared Footer) */}
      <footer className="mt-16 bg-[#f2f3ff] border-t border-[#c7c4d8]/20">
        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 w-full text-xs text-[#464555]">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#3525cd] text-sm">TiketHub</span>
            <span>|</span>
            <span>© 2025 TiketHub Ticketing Platform. Powered by Laravel &amp; Next.js.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#3525cd]">Explore Events</Link>
            <Link href="/" className="hover:text-[#3525cd]">Privacy Policy</Link>
            <Link href="/" className="hover:text-[#3525cd]">Terms of Service</Link>
          </div>
        </div>
      </footer>

      {/* Booking + Payment Status Modal */}
      {successBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#c7c4d8]/40 overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div
              className={`p-6 text-center relative text-white ${
                paymentState === 'paid'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  : paymentState === 'failed' || paymentState === 'expired'
                  ? 'bg-gradient-to-r from-rose-600 to-amber-600'
                  : 'bg-gradient-to-r from-[#3525cd] to-[#712ae2]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setSuccessBooking(null);
                  setSuccessPayment(null);
                  setPaymentState('idle');
                  setStatusMessage(null);
                }}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center mx-auto mb-3 shadow-inner">
                <span className="material-symbols-outlined text-[32px]">
                  {paymentState === 'paid'
                    ? 'verified'
                    : paymentState === 'failed'
                    ? 'error'
                    : paymentState === 'expired'
                    ? 'schedule_send'
                    : 'receipt_long'}
                </span>
              </div>
              <h3 className="text-[22px] font-extrabold tracking-tight">
                {paymentState === 'paid'
                  ? 'Payment Confirmed!'
                  : successBooking.payment_method === 'cash'
                  ? 'Ticket Reserved (Pay at Door)'
                  : paymentState === 'failed'
                  ? 'Payment Incomplete'
                  : paymentState === 'expired'
                  ? 'Reservation Expired'
                  : 'Booking Reserved!'}
              </h3>
              <p className="text-white/80 text-[13px] mt-1">
                {paymentState === 'paid'
                  ? 'Your transaction is confirmed. Your digital tickets are ready.'
                  : successBooking.payment_method === 'cash'
                  ? 'Present your ticket QR at the venue entrance and pay upon entry.'
                  : 'Your booking is held. Complete payment to secure admission.'}
              </p>
            </div>

            {/* Perforated Separation */}
            <div className="relative h-6 bg-[#faf8ff] flex items-center justify-center border-y border-dashed border-[#c7c4d8]/60">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-900/60" />
              <span className="text-[11px] font-mono tracking-widest text-[#777587] uppercase">
                BOOKING #{successBooking.id}
              </span>
            </div>

            {/* Booking Details */}
            <div className="p-6 flex flex-col gap-4 bg-white">
              <div>
                <span className="text-[11px] text-[#464555] uppercase font-bold tracking-wider">Event</span>
                <h4 className="text-[18px] font-extrabold text-[#131b2e] leading-snug">
                  {event.title}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-3 border-y border-[#c7c4d8]/20 text-[13px]">
                <div>
                  <span className="text-[#777587] block text-xs">Date &amp; Time</span>
                  <span className="font-bold text-[#131b2e]">{formattedDate}</span>
                </div>
                <div>
                  <span className="text-[#777587] block text-xs">Venue</span>
                  <span className="font-bold text-[#131b2e] truncate block">{event.location}</span>
                </div>
                <div>
                  <span className="text-[#777587] block text-xs">Tickets</span>
                  <span className="font-bold text-[#131b2e]">{successBooking.ticket_quantity} Pass(es)</span>
                </div>
                <div>
                  <span className="text-[#777587] block text-xs">Amount</span>
                  <span className="font-bold text-[#3525cd] font-mono">
                    {Number(successBooking.total_price).toLocaleString()} ETB
                  </span>
                </div>
                <div>
                  <span className="text-[#777587] block text-xs">Booking Status</span>
                  <span
                    className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-xs ${
                      paymentState === 'paid'
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-amber-700 bg-amber-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${paymentState === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {successBooking.booking_status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[#777587] block text-xs">Payment Method</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full text-xs uppercase">
                    {successBooking.payment_method}
                  </span>
                </div>
              </div>

              {/* Status Message Display */}
              {statusMessage && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-blue-600 shrink-0">info</span>
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Payment Instructions / Pending Block */}
              {successPayment && successPayment.instructions && paymentState !== 'paid' && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-sm text-blue-600">info</span>
                    <span>Payment Instructions ({successBooking.payment_method.toUpperCase()})</span>
                  </div>
                  <p>{successPayment.instructions}</p>
                  {successPayment.reference && (
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-blue-200/60 font-mono text-[11px] text-blue-800">
                      <span>Reference: {successPayment.reference}</span>
                      <button
                        type="button"
                        onClick={handleCheckStatus}
                        disabled={verifyingStatus}
                        className="px-2 py-1 rounded bg-blue-600 text-white font-sans text-[10px] font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {verifyingStatus ? (
                          <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[12px]">refresh</span>
                        )}
                        Check Status
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Unconfigured Provider State */}
              {!successPayment && successBooking.payment_method !== 'cash' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="material-symbols-outlined text-sm text-amber-600">schedule</span>
                    <span>Gateway Setup Notice — {successBooking.payment_method.toUpperCase()}</span>
                  </div>
                  <p>
                    Your booking is safely registered. Official <strong>{successBooking.payment_method.toUpperCase()}</strong> gateway
                    merchant credentials are being configured. You can complete payment from <strong>My Bookings</strong> once live.
                  </p>
                  {successBooking.expires_at && (
                    <p className="text-amber-700 font-medium mt-0.5">
                      ⏱ Reserved until: {new Date(successBooking.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}

              {/* Tickets Section (If generated & available) */}
              {bookingTickets.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-[#c7c4d8]/20">
                  <span className="text-[12px] font-bold text-[#131b2e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#3525cd]">qr_code_2</span>
                    Your Tickets ({bookingTickets.length})
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {bookingTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-[#c7c4d8]/40 bg-[#faf8ff] flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[11px] font-mono font-bold text-[#3525cd]">{t.ticket_identifier}</span>
                          <span className="text-[11px] text-slate-500 block">Seat #{t.seat_number}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/my-bookings"
                  className="flex-1 py-3 rounded-xl bg-[#3525cd] hover:bg-[#4f46e5] text-white font-bold text-[14px] text-center transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
                  View in My Bookings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessBooking(null);
                    setSuccessPayment(null);
                    setPaymentState('idle');
                    setStatusMessage(null);
                  }}
                  className="px-5 py-3 rounded-xl border border-[#c7c4d8]/60 hover:bg-[#faf8ff] text-[#131b2e] font-semibold text-[14px] transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
