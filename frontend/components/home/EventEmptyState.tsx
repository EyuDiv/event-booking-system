'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

interface EventEmptyStateProps {
  hasFilters: boolean;
  onResetFilters: () => void;
  isOrganizerOrAdmin?: boolean;
}

export default function EventEmptyState({
  hasFilters,
  onResetFilters,
  isOrganizerOrAdmin = false,
}: EventEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div
      id="emptyState"
      role="region"
      aria-label="No events found"
      className="py-14 px-6 text-center bg-white dark:bg-slate-900 border border-[#E4E7EC] dark:border-slate-800 rounded-3xl max-w-2xl mx-auto shadow-sm"
    >
      {/* Icon with refined brand glow container */}
      <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center mb-5 text-[#FF6500]">
        <span className="material-symbols-outlined text-[32px]">
          {hasFilters ? 'search_off' : 'event_busy'}
        </span>
      </div>

      {/* Heading */}
      <h3 className="text-[20px] font-bold text-[#101828] dark:text-white mb-2">
        {t('common.noEventsFound')}
      </h3>

      {/* Description */}
      <p className="text-[14px] text-[#667085] dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
        {hasFilters
          ? "We couldn't find any events matching your selected criteria. Try adjusting your search query, location, or clearing the active filters."
          : "There are currently no active events scheduled in this area. Check back soon as new concerts, conferences, and meetups are frequently added across Ethiopia."}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasFilters && (
          <button
            type="button"
            id="resetFilterBtn"
            onClick={onResetFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6500] hover:bg-[#E05A00] text-white font-semibold text-[13px] shadow-sm shadow-[#FF6500]/25 transition-all duration-150 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">restart_alt</span>
            <span>{t('customer.resetFilter')}</span>
          </button>
        )}

        <Link
          href={isOrganizerOrAdmin ? '/organizer/events/create' : '/login'}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E4E7EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#101828] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-[13px] transition-all duration-150 active:scale-95"
        >
          <span className="material-symbols-outlined text-[17px] text-[#FF6500]">add_circle</span>
          <span>{isOrganizerOrAdmin ? t('nav.createEvent') : t('customer.sellTickets')}</span>
        </Link>
      </div>
    </div>
  );
}
