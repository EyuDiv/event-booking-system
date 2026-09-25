'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getStoredAuth, fetchOrganizerEventAnalytics, OrganizerEventAnalyticsResponse } from '@/lib/api';

export default function EventAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = Number(params.id);
  
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<OrganizerEventAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { token, user } = getStoredAuth();
    if (!token || !user) {
      router.push('/login');
      return;
    }

    if (!eventId || isNaN(eventId)) {
      setError('Invalid Event ID.');
      setLoading(false);
      return;
    }

    fetchOrganizerEventAnalytics(eventId)
      .then(res => setAnalytics(res))
      .catch(err => {
        if (err.response?.status === 403 || err.response?.status === 404) {
          setError('Event not found or you do not have permission to view it.');
        } else {
          setError('Failed to load event analytics.');
        }
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [eventId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="text-[#712ae2] font-semibold text-lg animate-pulse">Loading Event Analytics…</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-[#faf8ff] p-6 sm:p-10 flex flex-col items-center">
        <div className="max-w-2xl w-full bg-white p-8 rounded-2xl border border-red-200 text-center shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-red-500 mb-4">error</span>
          <h2 className="text-[20px] font-bold text-[#131b2e] mb-2">Error Loading Analytics</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link href="/organizer/dashboard" className="text-[#712ae2] font-bold hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { event } = analytics;
  const ticketsSold = event.total_tickets - event.available_tickets;

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/organizer/dashboard" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shrink-0">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[16px] sm:text-[18px] font-extrabold text-[#131b2e] truncate">{event.title}</h1>
            <div className="text-[12px] text-slate-500 font-medium">Event Analytics</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/organizer/events/${event.id}/edit`} className="px-3 sm:px-4 py-2 rounded-xl text-[12px] sm:text-[13px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
            Edit
          </Link>
          <Link href={`/organizer/events/${event.id}/bookings`} className="px-3 sm:px-4 py-2 rounded-xl text-[12px] sm:text-[13px] font-bold text-[#712ae2] bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors">
            Attendees
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 sm:p-10 flex-grow">
        
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-extrabold text-[#131b2e] mb-1">Performance Overview</h2>
            <div className="text-slate-500 text-[13px] sm:text-[14px]">Status: <span className="font-bold text-[#131b2e] capitalize">{event.status}</span> • Category: <span className="font-bold text-[#131b2e]">{event.category}</span></div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-slate-500 text-[12px] font-bold uppercase tracking-wider mb-1">Total Revenue</div>
            <div className="text-[26px] sm:text-[32px] font-extrabold text-[#712ae2]">
              <span className="text-[18px] sm:text-[20px] text-purple-400 mr-1">ETB</span>
              {(Number(event.revenue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Sales & Inventory */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="material-symbols-outlined text-[20px] text-blue-500">local_activity</span>
              <h3 className="font-bold">Sales & Inventory</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-500 text-[13px]">Total Capacity</span>
                <span className="font-bold text-[#131b2e]">{event.total_tickets}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-500 text-[13px]">Tickets Sold</span>
                <span className="font-bold text-[#131b2e]">{ticketsSold}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-500 text-[13px]">Available</span>
                <span className="font-bold text-emerald-600">{event.available_tickets}</span>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[11px] font-bold mb-1">
                <span className="text-[#712ae2]">{Math.round((ticketsSold / event.total_tickets) * 100)}% Sold</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#712ae2] to-blue-500 rounded-full" style={{ width: `${Math.min(100, (ticketsSold / event.total_tickets) * 100)}%` }}></div>
              </div>
            </div>
          </div>

          {/* Bookings Breakdown */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="material-symbols-outlined text-[20px] text-emerald-500">book_online</span>
              <h3 className="font-bold">Bookings Status</h3>
            </div>
            <div className="text-[32px] font-extrabold text-[#131b2e]">{event.total_bookings_count} <span className="text-[14px] text-slate-500 font-medium">total bookings</span></div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-slate-600 text-[13px]">Confirmed</span>
                </div>
                <span className="font-bold text-[#131b2e]">{event.confirmed_bookings_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-slate-600 text-[13px]">Pending (Unpaid)</span>
                </div>
                <span className="font-bold text-[#131b2e]">{event.pending_bookings_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-slate-600 text-[13px]">Cancelled</span>
                </div>
                <span className="font-bold text-[#131b2e]">{event.cancelled_bookings_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <span className="text-slate-600 text-[13px]">Expired</span>
                </div>
                <span className="font-bold text-[#131b2e]">{event.expired_bookings_count}</span>
              </div>
            </div>
          </div>

          {/* Check-ins */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="material-symbols-outlined text-[20px] text-indigo-500">how_to_reg</span>
              <h3 className="font-bold">Check-ins</h3>
            </div>
            <div className="flex-grow flex flex-col justify-center items-center py-4">
              <div className="relative flex items-center justify-center mb-2">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * (ticketsSold > 0 ? event.checked_in_tickets_count / ticketsSold : 0))} className="text-indigo-500 transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[20px] font-extrabold text-[#131b2e]">{event.checked_in_tickets_count}</span>
                </div>
              </div>
              <div className="text-slate-500 text-[13px] text-center mt-2">
                Checked in out of <strong className="text-[#131b2e]">{ticketsSold}</strong> sold tickets
              </div>
            </div>
            
            <Link href="/organizer/check-in" className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] text-center transition-colors">
              Open Gate Scanner
            </Link>
          </div>

        </div>

      </main>
    </div>
  );
}
