'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

export interface CategoryItem {
  key: string;
  label: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'Music', label: 'Music', icon: 'music_note' },
  { key: 'Technology', label: 'Technology', icon: 'devices' },
  { key: 'Cultural', label: 'Cultural', icon: 'theater_comedy' },
  { key: 'Food & Drinks', label: 'Food & Drinks', icon: 'restaurant' },
  { key: 'Networking', label: 'Networking', icon: 'groups' },
];

interface CategoryNavigationProps {
  activeCategory: string;
  onSelectCategory: (categoryKey: string) => void;
  extraCategories?: string[];
  totalCount: number;
  loading: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export default function CategoryNavigation({
  activeCategory,
  onSelectCategory,
  extraCategories = [],
  totalCount,
  loading,
  hasActiveFilters,
  onResetFilters,
}: CategoryNavigationProps) {
  const { t } = useTranslation();

  return (
    <section className="max-w-[80rem] mx-auto px-4 sm:px-6 mt-16 sm:mt-18 mb-8" id="categories">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EC] dark:border-slate-800">
        
        {/* Horizontal Scrollable Category Pills */}
        <div
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
          id="categoryFilterContainer"
          role="tablist"
          aria-label="Event categories"
        >
          {DEFAULT_CATEGORIES.map((item) => {
            const isSelected =
              activeCategory === item.key || (item.key === 'all' && activeCategory === 'all');

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-filter={item.key}
                onClick={() => onSelectCategory(item.key)}
                className={`category-filter-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF6500] hover:bg-[#E05A00] text-white shadow-md shadow-[#FF6500]/20 border border-transparent'
                    : 'bg-white dark:bg-slate-800 text-[#667085] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#101828] dark:hover:text-white border border-[#E4E7EC] dark:border-slate-700 hover:-translate-y-0.5'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                <span>{t(`categories.${item.key}`)}</span>
              </button>
            );
          })}

          {/* Any extra dynamic categories discovered from MySQL backend */}
          {extraCategories.map((catName) => {
            const isSelected = activeCategory === catName;
            return (
              <button
                key={catName}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-filter={catName}
                onClick={() => onSelectCategory(catName)}
                className={`category-filter-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-[13px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF6500] hover:bg-[#E05A00] text-white shadow-md shadow-[#FF6500]/20 border border-transparent'
                    : 'bg-white dark:bg-slate-800 text-[#667085] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#101828] dark:hover:text-white border border-[#E4E7EC] dark:border-slate-700 hover:-translate-y-0.5'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">local_activity</span>
                <span>{catName}</span>
              </button>
            );
          })}
        </div>

        {/* Counter & Reset Filter CTA */}
        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
          <span className="text-[13px] font-medium text-[#667085] dark:text-slate-400" id="eventsCountText">
            {t('customer.showingVerifiedEvents', { count: loading ? '…' : totalCount })}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              id="resetFilterHeaderBtn"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#FF6500] hover:text-[#E05A00] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">restart_alt</span>
              <span>{t('customer.resetFilter')}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
