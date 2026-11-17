'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

interface EventErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function EventErrorState({ message, onRetry }: EventErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div
      id="errorState"
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-3xl max-w-xl mx-auto shadow-sm"
    >
      <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
        <span className="material-symbols-outlined text-[32px]">error</span>
      </div>

      <h3 className="text-[19px] font-bold text-[#101828] dark:text-white mb-2">
        {t('common.unableToLoadEvents')}
      </h3>

      <p className="text-[14px] text-[#667085] dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {message || t('common.somethingWentWrong')}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 bg-[#FF6500] hover:bg-[#E05A00] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl shadow-sm shadow-[#FF6500]/25 transition-all duration-150 active:scale-95 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
        <span>{t('common.tryAgain')}</span>
      </button>
    </div>
  );
}
