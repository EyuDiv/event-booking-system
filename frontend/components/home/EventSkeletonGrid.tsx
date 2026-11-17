'use client';

import React from 'react';

export default function EventSkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      aria-busy="true"
      aria-label="Loading events..."
      id="loadingSkeletonGrid"
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="bg-white dark:bg-slate-900 border border-[#E4E7EC] dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between animate-pulse"
        >
          {/* Cover Placeholder */}
          <div className="aspect-[16/10] bg-slate-200/70 dark:bg-slate-800" />

          {/* Body Placeholder */}
          <div className="p-5 space-y-3.5 flex-1">
            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-3/5 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-full pt-1" />
          </div>

          {/* Footer Placeholder */}
          <div className="px-5 py-3.5 border-t border-[#E4E7EC] dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-2.5 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
