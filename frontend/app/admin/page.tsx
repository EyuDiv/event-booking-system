'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAdminDashboard,
  updateAdminEventStatus,
  type AdminDashboardResponse,
} from '@/lib/admin-api';
import type { EventItem } from '@/types/event';
import { useTranslation } from '@/lib/i18n';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'ytd'>('today');

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [eventToCancel, setEventToCancel] = useState<EventItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Quick Actions Modal State
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetchAdminDashboard();
        setData(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  function handleOpenCancelModal(event: EventItem) {
    setEventToCancel(event);
    setCancelModalOpen(true);
  }

  function handleCloseCancelModal() {
    setEventToCancel(null);
    setCancelModalOpen(false);
  }

  async function handleConfirmCancellation() {
    if (!eventToCancel) return;
    try {
      setCancelling(true);
      await updateAdminEventStatus(eventToCancel.id, 'cancelled');

      // Update state locally
      if (data) {
        setData({
          ...data,
          metrics: {
            ...data.metrics,
            active_events: Math.max(0, data.metrics.active_events - 1),
          },
          recent_activity: {
            ...data.recent_activity,
            events: data.recent_activity.events.map((e) =>
              e.id === eventToCancel.id ? { ...e, status: 'cancelled' } : e
            ),
          },
        });
      }
      handleCloseCancelModal();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel event.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-pulse">
          <div>
            <div className="h-8 bg-surface-container-high rounded-xl w-64 mb-2"></div>
            <div className="h-4 bg-surface-container-high rounded-lg w-96"></div>
          </div>
          <div className="h-10 bg-surface-container-high rounded-xl w-72"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm h-32"></div>
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 bg-error-container border border-error/20 text-on-error-container rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-2xl">error</span>
          <span>{error || t('common.somethingWentWrong')}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-white text-error font-semibold text-xs rounded-xl shadow-xs hover:bg-surface-container-low transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const { metrics, recent_activity } = data;

  // Real calculations
  const conversionRate =
    metrics.total_bookings > 0
      ? ((metrics.confirmed_bookings / metrics.total_bookings) * 100).toFixed(1)
      : '100';

  const passesPerOrder =
    metrics.total_bookings > 0
      ? (metrics.tickets_sold / metrics.total_bookings).toFixed(1)
      : '1.0';

  const approxUsd = Math.round(metrics.total_revenue / 125);

  return (
    <section className="space-y-6" id="view-dashboard">
      {/* ==================== WELCOME HERO & FILTER BAR ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-extrabold text-on-surface tracking-tight">
            {t('admin.overview')}
          </h1>
          <p className="text-on-surface-variant font-body-md text-body-md">
            {t('admin.overviewSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-white border border-outline-variant/30 p-1 shadow-xs">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                timeFilter === 'today'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t('common.today')}
            </button>
            <button
              onClick={() => setTimeFilter('7days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                timeFilter === '7days'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t('common.days7')}
            </button>
            <button
              onClick={() => setTimeFilter('30days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                timeFilter === '30days'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t('common.days30')}
            </button>
            <button
              onClick={() => setTimeFilter('ytd')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                timeFilter === 'ytd'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t('common.yearToDate')}
            </button>
          </div>
          <button
            onClick={() => setQuickActionsOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">verified_user</span>
            <span>{t('admin.quickActions')}</span>
          </button>
        </div>
      </div>

      {/* ==================== METRIC ROW 1 (Users, Events, Inventory) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs relative overflow-hidden group hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.totalUsers')}</span>
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">group</span>
            </span>
          </div>
          <div className="mt-3">
            <span className="font-headline-xl text-headline-xl font-extrabold text-on-surface">
              {metrics.total_users.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                <span className="material-symbols-outlined text-sm">trending_up</span> +12.4%
              </span>
              <span className="text-xs text-outline-variant">{t('admin.vsLastMonth')}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        {/* Card 2: Total Events */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs relative overflow-hidden group hover:border-amber-400/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.totalEvents')}</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <span className="material-symbols-outlined text-xl">event_available</span>
            </span>
          </div>
          <div className="mt-3">
            <span className="font-headline-xl text-headline-xl font-extrabold text-on-surface">
              {metrics.total_events.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                {metrics.total_events - metrics.active_events > 0
                  ? `${metrics.total_events - metrics.active_events} ${t('admin.pendingReview')}`
                  : t('status.active')}
              </span>
              <span className="text-xs text-outline-variant">{t('admin.requiresReview')}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        {/* Card 3: Active Events */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.activeEvents')}</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <span className="material-symbols-outlined text-xl">broadcast_on_personal</span>
            </span>
          </div>
          <div className="mt-3">
            <span className="font-headline-xl text-headline-xl font-extrabold text-on-surface">
              {metrics.active_events.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping"></span> {t('admin.liveNow')}
              </span>
              <span className="text-xs text-outline-variant">{t('admin.acrossEthiopia')}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        {/* Card 4: Sold Out Events */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs relative overflow-hidden group hover:border-secondary/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.soldOutEvents')}</span>
            <span className="p-2 rounded-xl bg-secondary/10 text-secondary">
              <span className="material-symbols-outlined text-xl">stars</span>
            </span>
          </div>
          <div className="mt-3">
            <span className="font-headline-xl text-headline-xl font-extrabold text-on-surface">
              {metrics.sold_out_events.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center text-xs font-bold text-secondary bg-secondary-fixed/50 px-1.5 py-0.5 rounded">
                {t('admin.highSellThrough')}
              </span>
              <span className="text-xs text-outline-variant">{t('admin.fullCapacity')}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>

      {/* ==================== METRIC ROW 2 (Financials & Bookings Performance) ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 5: Total Bookings */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.totalBookings')}</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg font-extrabold text-on-surface">
              {metrics.total_bookings.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              +18.2%
            </span>
          </div>
          <p className="text-xs text-outline-variant mt-1">{t('admin.totalSessions')}</p>
        </div>

        {/* Card 6: Confirmed Bookings */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.confirmedBookings')}</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg font-extrabold text-on-surface">
              {metrics.confirmed_bookings.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {conversionRate}% Conv
            </span>
          </div>
          <p className="text-xs text-outline-variant mt-1">{t('admin.paidQrMinted')}</p>
        </div>

        {/* Card 7: Tickets Sold */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-outline">{t('admin.ticketsSold')}</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-headline-lg text-headline-lg font-extrabold text-on-surface">
              {metrics.tickets_sold.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
              {t('admin.passes')}
            </span>
          </div>
          <p className="text-xs text-outline-variant mt-1">
            {t('admin.avgPasses', { avg: passesPerOrder })}
          </p>
        </div>

        {/* Card 8: Gross GMV Revenue */}
        <div className="bg-gradient-to-br from-primary via-primary to-secondary p-5 rounded-2xl text-white shadow-lg shadow-primary/20">
          <div className="flex items-center justify-between text-white/80">
            <span className="text-xs font-bold uppercase tracking-wider">{t('admin.grossGmvRevenue')}</span>
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
          </div>
          <div className="mt-2">
            <span className="font-headline-lg text-headline-lg font-extrabold text-white tracking-tight">
              {(Number(metrics.total_revenue) || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ETB
            </span>
            <p className="text-xs text-inverse-primary/90 mt-1 flex items-center justify-between font-semibold">
              <span>≈ ${approxUsd.toLocaleString()} USD</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-[11px]">+22.4% MoM</span>
            </p>
          </div>
        </div>
      </div>

      {/* ==================== ADMIN FAST BAR ==================== */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-outline-variant mr-1">
            {t('admin.fastBar')}
          </span>
          <Link
            href="/admin/users"
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-primary">person_add</span> {t('admin.manageUsers')}
          </Link>
          <Link
            href="/admin/events"
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-amber-600">playlist_add_check</span>{' '}
            {t('admin.manageEvents')} ({metrics.total_events})
          </Link>
          <Link
            href="/admin/bookings"
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-secondary">receipt</span> {t('admin.viewBookings')}
          </Link>
          <Link
            href="/admin/payments"
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-emerald-600">account_balance</span>{' '}
            {t('admin.auditPayments')}
          </Link>
          <Link
            href="/organizer/check-in"
            className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-indigo-600">qr_code_scanner</span> {t('admin.gateScanner')}
          </Link>
        </div>
        <div className="flex items-center gap-2 text-xs text-outline font-medium">
          <span className="material-symbols-outlined text-base text-emerald-500">lock</span>
          {t('admin.sessionSigned2fa')}
        </div>
      </div>

      {/* ==================== DUAL DATA SECTION: Left: Events / Right: Bookings Stream ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Recent Events Table (7 cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {t('admin.recentEvents')}
                </h2>
                <p className="text-xs text-outline-variant">
                  {t('admin.recentEventsSubtitle')}
                </p>
              </div>
              <Link
                href="/admin/events"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                {t('admin.viewFullRoster')} <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-[11px] uppercase tracking-wider font-bold text-outline">
                    <th className="pb-3 pr-4 font-semibold">{t('common.event')} &amp; {t('common.organizer')}</th>
                    <th className="pb-3 pr-4 font-semibold whitespace-nowrap">{t('common.date')} &amp; {t('common.venue')}</th>
                    <th className="pb-3 pr-4 font-semibold">{t('common.capacity')}</th>
                    <th className="pb-3 pr-4 font-semibold">{t('common.status')}</th>
                    <th className="pb-3 font-semibold text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs">
                  {recent_activity.events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-outline-variant">
                        {t('common.noEventsFound')}
                      </td>
                    </tr>
                  ) : (
                    recent_activity.events.map((event) => {
                      const soldTickets = event.total_tickets - event.available_tickets;
                      const soldPct = Math.min(
                        100,
                        Math.round((soldTickets / (event.total_tickets || 1)) * 100)
                      );
                      const isSoldOut = event.status === 'sold_out' || soldPct >= 100;
                      const isLive = event.status === 'active';

                      return (
                        <tr key={event.id} className="hover:bg-surface-container-low/50 transition-colors group">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              {event.image_url ? (
                                <img
                                  src={event.image_url}
                                  alt={event.title}
                                  className="w-10 h-10 rounded-xl object-cover border border-outline-variant/20 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/20 flex items-center justify-center shrink-0 text-primary">
                                  <span className="material-symbols-outlined text-xl">event</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link
                                  href={`/events/${event.id}`}
                                  className="font-bold text-on-surface group-hover:text-primary transition-colors block truncate max-w-[160px] sm:max-w-[200px]"
                                  title={event.title}
                                >
                                  {event.title}
                                </Link>
                                <span className="text-[11px] text-outline-variant block truncate max-w-[160px]">
                                  by {event.organizer?.name || 'Authorized Host'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-semibold text-on-surface block whitespace-nowrap">
                              {new Date(event.event_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <span
                              className="text-[11px] text-outline-variant max-w-[130px] truncate block"
                              title={event.location}
                            >
                              {event.location}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="w-28">
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="font-semibold text-on-surface">
                                  {soldTickets.toLocaleString()}
                                </span>
                                <span className="text-outline-variant">
                                  / {event.total_tickets.toLocaleString()}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isSoldOut ? 'bg-secondary' : soldPct > 50 ? 'bg-primary' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${soldPct}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t('status.live')}
                              </span>
                            ) : isSoldOut ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {t('status.soldOut')}
                              </span>
                            ) : event.status === 'draft' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span> {t('status.draft')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {event.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/events/${event.id}`}
                                className="p-1 rounded-lg text-outline-variant hover:text-primary hover:bg-surface-container transition-colors"
                                title={t('common.view')}
                              >
                                <span className="material-symbols-outlined text-base">visibility</span>
                              </Link>
                              {event.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleOpenCancelModal(event)}
                                  className="p-1 rounded-lg text-outline-variant hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title={t('customer.cancelBooking')}
                                >
                                  <span className="material-symbols-outlined text-base">cancel</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer summary indicator inside table card */}
          <div className="pt-4 mt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs text-outline-variant">
            <span>
              {t('admin.showingEvents', {
                count: recent_activity.events.length,
                total: metrics.active_events || metrics.total_events,
              })}
            </span>
            <span className="text-primary font-semibold">{t('admin.realTimeSync')}</span>
          </div>
        </div>

        {/* RIGHT: Live Bookings Stream (5 cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {t('admin.recentBookings')}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-full">
                telebirr / Chapa / CBE
              </span>
            </div>

            {/* Stream items */}
            <div className="space-y-3">
              {recent_activity.bookings.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center text-outline-variant mb-2">
                    <span className="material-symbols-outlined text-2xl">receipt_long</span>
                  </div>
                  <p className="text-xs font-bold text-on-surface">{t('common.noBookingsFound')}</p>
                  <p className="text-[11px] text-outline-variant max-w-xs mt-0.5">
                    Real-time bookings will stream here once customers purchase tickets nationwide.
                  </p>
                </div>
              ) : (
                recent_activity.bookings.map((booking) => {
                  const initial = (booking.user?.name || 'U')[0].toUpperCase();
                  const method = (booking.payment_method || (booking as any).payment?.payment_method || 'telebirr').toLowerCase();
                  const isTelebirr = method.includes('telebirr');
                  const isChapa = method.includes('chapa');
                  const isCbe = method.includes('cbe');

                  const badgeColor = isTelebirr
                    ? 'bg-indigo-100 text-indigo-800'
                    : isChapa
                    ? 'bg-emerald-100 text-emerald-800'
                    : isCbe
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-surface-container text-on-surface-variant';

                  const displayMethod = isTelebirr ? 'telebirr' : isChapa ? 'Chapa' : isCbe ? 'CBE Birr' : method;

                  return (
                    <div
                      key={booking.id}
                      className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between border border-outline-variant/10"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-on-surface truncate">
                              {booking.user?.name || 'Registered Customer'}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${badgeColor}`}>
                              {displayMethod}
                            </span>
                          </div>
                          <p className="text-[11px] text-outline-variant truncate">
                            {booking.event?.title || 'Event'} • {booking.ticket_quantity}x{' '}
                            {t('common.tickets')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-numeric-data text-numeric-data font-bold text-on-surface block">
                          {parseFloat(booking.total_price.toString()).toLocaleString()} ETB
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            booking.booking_status === 'confirmed'
                              ? 'text-emerald-600 bg-emerald-50'
                              : booking.booking_status === 'pending'
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-rose-600 bg-rose-50'
                          }`}
                        >
                          {booking.booking_status === 'confirmed'
                            ? t('status.confirmed')
                            : booking.booking_status === 'pending'
                            ? t('status.pending')
                            : t('status.cancelled')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer summary inside stream card */}
          <div className="pt-4 mt-3 border-t border-outline-variant/20 flex items-center justify-between">
            <span className="text-xs text-outline-variant font-medium">{t('admin.webhookSuccess')}</span>
            <Link href="/admin/bookings" className="text-xs font-bold text-primary hover:underline">
              {t('admin.viewLedger')}
            </Link>
          </div>
        </div>
      </div>

      {/* ==================== MODAL 1: EVENT CANCELLATION WARNING OVERLAY ==================== */}
      {cancelModalOpen && eventToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
                {t('admin.cancelEventModalTitle')}
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t('admin.cancelEventModalDesc')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="truncate pr-2">{eventToCancel.title}</span>
                <span className="text-rose-700 shrink-0">{t('admin.irreversible')}</span>
              </div>
              <p className="text-[11px] text-rose-800">
                {t('admin.escrowLockedNotice')}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCloseCancelModal}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-on-surface font-semibold text-xs hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                {t('admin.keepEvent')}
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancellation}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancelling ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{t('admin.cancelling')}</span>
                  </>
                ) : (
                  <span>{t('admin.confirmCancellation')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: QUICK ACTIONS MODAL ==================== */}
      {quickActionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {t('admin.fastActionsTitle')}
                </h3>
                <p className="text-xs text-outline-variant">
                  {t('admin.fastActionsSubtitle')}
                </p>
              </div>
              <button
                onClick={() => setQuickActionsOpen(false)}
                className="p-1.5 rounded-xl text-outline-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                aria-label={t('common.close')}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Link
                href="/admin/users"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-xl">group</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('admin.userDirectory')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.userDirectorySubtitle')}</span>
                </div>
              </Link>
              <Link
                href="/admin/events"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <span className="material-symbols-outlined text-xl">playlist_add_check</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('admin.reviewEvents')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.reviewEventsSubtitle')}</span>
                </div>
              </Link>
              <Link
                href="/admin/bookings"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-secondary/10 text-secondary">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('admin.viewBookings')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.viewBookingsSubtitle')}</span>
                </div>
              </Link>
              <Link
                href="/admin/payments"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('admin.paymentGateways')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.paymentGatewaysSubtitle')}</span>
                </div>
              </Link>
              <Link
                href="/organizer/check-in"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('admin.gateScanner')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.turnstileValidator')}</span>
                </div>
              </Link>
              <Link
                href="/admin/analytics"
                onClick={() => setQuickActionsOpen(false)}
                className="p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 flex items-center gap-3 transition-colors"
              >
                <span className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                  <span className="material-symbols-outlined text-xl">monitoring</span>
                </span>
                <div>
                  <span className="font-bold text-xs text-on-surface block">{t('nav.analytics')}</span>
                  <span className="text-[11px] text-outline-variant">{t('admin.growthThroughput')}</span>
                </div>
              </Link>
            </div>
            <div className="pt-2 text-right">
              <button
                onClick={() => setQuickActionsOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
