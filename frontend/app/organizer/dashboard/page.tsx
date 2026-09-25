'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getStoredAuth, logoutUser, fetchOrganizerAnalytics, OrganizerAnalyticsResponse } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import type { AuthUser } from '@/types/auth';

export default function OrganizerDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<OrganizerAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login');
      return;
    }
    setUser(authUser);
    
    fetchOrganizerAnalytics()
      .then(res => {
        setAnalytics(res);
      })
      .catch(err => {
        setError('Failed to load analytics.');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="text-[#712ae2] font-semibold text-lg animate-pulse">Loading Organizer Studio…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#712ae2] text-[28px]">
            campaign
          </span>
          <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          <span className="hidden min-[420px]:inline-block ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
            Organizer Studio
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher variant="pill" />
          <NotificationBell />
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
            <span className="hidden sm:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full p-6 sm:p-10 flex-grow">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 tier-2-shadow mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-[#712ae2]">
              <span className="material-symbols-outlined text-[28px]">insights</span>
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-[#131b2e]">
                {t('organizer.dashboard')}
              </h1>
              <p className="text-[14px] text-slate-600">
                {t('organizer.dashboardSubtitle')}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
            <Link
              href="/organizer/events"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#712ae2] to-[#3525cd] hover:opacity-95 text-white font-bold text-[14px] shadow-xs flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">event_note</span>
              {t('organizer.myEvents')}
            </Link>
            <Link
              href="/organizer/events/create"
              className="px-5 py-3 rounded-xl border border-[#712ae2] text-[#712ae2] hover:bg-purple-50 font-bold text-[14px] flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              {t('organizer.createEvent')}
            </Link>
            <Link
              href="/organizer/check-in"
              className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[14px] flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              {t('organizer.gateCheckIn')}
            </Link>
          </div>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[13px] flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        ) : analytics ? (
          <>
            <h2 className="text-[18px] font-bold text-[#131b2e] mb-4">{t('organizer.analytics')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('admin.totalEvents')}</span>
                <span className="text-[28px] font-extrabold text-[#131b2e] truncate">{analytics.overall.total_events}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('admin.activeEvents')}</span>
                <span className="text-[28px] font-extrabold text-emerald-600 truncate">{analytics.overall.active_events}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('admin.totalBookings')}</span>
                <span className="text-[28px] font-extrabold text-[#712ae2] truncate">{analytics.overall.total_bookings}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('organizer.revenue')} (ETB)</span>
                <span className="text-[26px] sm:text-[28px] font-extrabold text-slate-800 truncate" title={(analytics.overall.total_revenue ?? 0).toString()}>
                  {(Number(analytics.overall.total_revenue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('organizer.ticketsSold')}</span>
                <span className="text-[28px] font-extrabold text-[#131b2e] truncate">{analytics.overall.total_tickets_sold}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('organizer.checkedIn')}</span>
                <span className="text-[28px] font-extrabold text-emerald-600 truncate">{analytics.overall.checked_in_tickets}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('admin.confirmedBookings')}</span>
                <span className="text-[28px] font-extrabold text-indigo-600 truncate">{analytics.overall.confirmed_bookings}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-slate-500 text-[12px] font-bold uppercase tracking-wider">{t('status.draft')}</span>
                <span className="text-[28px] font-extrabold text-slate-500 truncate">{analytics.overall.draft_events}</span>
              </div>
            </div>

            <h2 className="text-[18px] font-bold text-[#131b2e] mb-4">Event Performance</h2>
            {analytics.events.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">event_busy</span>
                <p className="text-slate-500 font-semibold">No events found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.events.map(event => (
                  <Link href={`/organizer/events/${event.id}/analytics`} key={event.id} className="block group">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group-hover:border-[#712ae2] group-hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[16px] font-bold text-[#131b2e] group-hover:text-[#712ae2] transition-colors">{event.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          event.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                          event.status === 'draft' ? 'bg-slate-100 text-slate-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-slate-600">
                        <div><strong className="text-slate-900">Revenue:</strong> ETB {(event.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div><strong className="text-slate-900">Tickets Sold:</strong> {event.total_tickets - event.available_tickets} / {event.total_tickets}</div>
                        <div><strong className="text-slate-900">Bookings:</strong> {event.total_bookings_count}</div>
                        <div><strong className="text-slate-900">Checked In:</strong> {event.checked_in_tickets_count}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
