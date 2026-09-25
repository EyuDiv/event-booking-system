'use client';

import React, { useEffect, useState } from 'react';
import { fetchAdminDashboard, type AdminDashboardResponse } from '@/lib/admin-api';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetchAdminDashboard();
        setData(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="animate-pulse text-slate-600">Loading analytics...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
        {error}
      </div>
    );
  }

  const { charts } = data;
  
  // Helper to safely render simple bars
  const renderBars = (dataset: {month: string, count?: number, sum?: number}[], isCurrency = false) => {
    if (!dataset || dataset.length === 0) return <div className="text-slate-500 text-sm">No data available.</div>;
    const maxVal = Math.max(...dataset.map(d => d.count || d.sum || 0), 1);
    
    return (
      <div className="flex items-end gap-1.5 sm:gap-2 h-48 mt-4 pt-4 border-b border-slate-200 overflow-x-auto min-w-0">
        {dataset.map(item => {
          const val = item.count || item.sum || 0;
          const height = Math.max((val / maxVal) * 100, 2); // At least 2% to show a bump
          return (
            <div key={item.month} className="flex-1 flex flex-col items-center justify-end group min-w-[36px]">
              <div 
                className="w-full max-w-[40px] bg-indigo-500 hover:bg-indigo-400 rounded-t-sm transition-all relative"
                style={{ height: `${height}%` }}
              >
                <div className="absolute bottom-full mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {item.month}: {isCurrency ? `ETB ${(Number(val) || 0).toLocaleString()}` : val}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 truncate w-full text-center">
                {item.month}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-6 sm:mb-8">System Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Registrations Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">group_add</span>
            User Registrations (6 Months)
          </h2>
          {renderBars(charts?.users || [])}
        </div>

        {/* Bookings Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">shopping_cart</span>
            Bookings Created (6 Months)
          </h2>
          {renderBars(charts?.bookings || [])}
        </div>

        {/* Revenue Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">payments</span>
            Revenue (6 Months)
          </h2>
          {renderBars(charts?.revenue || [], true)}
        </div>

      </div>
    </div>
  );
}
