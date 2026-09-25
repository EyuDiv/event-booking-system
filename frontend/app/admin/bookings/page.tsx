'use client';

import React, { useEffect, useState } from 'react';
import { fetchAdminBookings, type AdminBookingsResponse } from '@/lib/admin-api';

export default function AdminBookingsPage() {
  const [data, setData] = useState<AdminBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        const res = await fetchAdminBookings({ page });
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load bookings.');
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bookings</h1>
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
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Event</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Booking Status</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[14px]">
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Loading bookings...
                  </td>
                </tr>
              ) : data?.bookings.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                data?.bookings.data.map(booking => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">{booking.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{booking.user?.name}</td>
                    <td className="px-6 py-4 text-slate-700">{booking.event?.title}</td>
                    <td className="px-6 py-4 text-slate-900 font-mono">ETB {booking.total_price}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        booking.booking_status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                        booking.booking_status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {booking.booking_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        booking.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {booking.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(booking.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.bookings.last_page > 1 && (
          <div className="p-4 border-t border-slate-200 flex justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-slate-600">
              Page {page} of {data.bookings.last_page}
            </span>
            <button
              disabled={page === data.bookings.last_page}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
