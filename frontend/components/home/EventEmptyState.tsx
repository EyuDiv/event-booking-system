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
      className="py-12 px-6 text-center bg-white dark:bg-slate-900 border border-[#E4E7EC] dark:border-slate-800 rounded-3xl max-w-xl mx-auto shadow-xs"
    >
      {/* Calendar / Discovery Icon in refined subtle orange circle */}
      <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 flex items-center justify-center mb-4 text-[#FF6500]">
        <span className="material-symbols-outlined text-[30px]">
          calendar_month
        </span>
      </div>

      {/* Heading */}
      <h3 className="text-[19px] font-bold text-[#101828] dark:text-white mb-2">
        {t('common.noEventsFound')}
      </h3>

      {/* Supporting text */}
      <p className="text-[14px] text-[#667085] dark:text-slate-400 mb-5 max-w-md mx-auto leading-relaxed">
        There are currently no verified events matching your selection. Check back soon for new experiences.
      </p>

      {/* Zero count badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[#667085] dark:text-slate-300 text-[12px] font-semibold mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>0 verified events</span>
      </div>

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
