'use client';

import React, { useEffect, useState } from 'react';
import { fetchAdminEvents, updateAdminEventStatus, type AdminEventsResponse } from '@/lib/admin-api';
import type { EventItem } from '@/types/event';

export default function AdminEventsPage() {
  const [data, setData] = useState<AdminEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Status Edit State
  const [cancelingEvent, setCancelingEvent] = useState<EventItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const res = await fetchAdminEvents({ page });
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load events.');
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [page]);

  async function handleCancelEvent() {
    if (!cancelingEvent) return;
    try {
      setSaving(true);
      await updateAdminEventStatus(cancelingEvent.id, 'cancelled');
      setCancelingEvent(null);
      // Refresh events to show new status
      const res = await fetchAdminEvents({ page });
      setData(res);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel event.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Events Management</h1>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[12px] uppercase text-slate-500 font-semibold tracking-wider">
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Organizer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Capacity</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[14px]">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading events...
                  </td>
                </tr>
              ) : data?.events.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No events found.
                  </td>
                </tr>
              ) : (
                data?.events.data.map(event => (
                  <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{event.title}</td>
                    <td className="px-6 py-4 text-slate-600">{event.organizer?.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        event.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        event.status === 'sold_out' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {event.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {(event.total_tickets - event.available_tickets)} / {event.total_tickets}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(event.event_date).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {event.status !== 'cancelled' && (
                        <button
                          onClick={() => setCancelingEvent(event as EventItem)}
                          className="text-rose-600 hover:text-rose-800 font-semibold text-[13px] hover:underline"
                        >
                          Cancel Event
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.events.last_page > 1 && (
          <div className="p-4 border-t border-slate-200 flex justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-slate-600">
              Page {page} of {data.events.last_page}
            </span>
            <button
              disabled={page === data.events.last_page}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Cancel Event</h2>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4 text-sm text-rose-800 flex gap-2">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <div>
                Are you sure you want to cancel <strong>{cancelingEvent.title}</strong>? 
                This will trigger cancellation workflows and cannot be easily undone.
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCancelingEvent(null)}
                className="px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleCancelEvent}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-white bg-rose-600 hover:bg-rose-700 font-semibold disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? 'Canceling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
