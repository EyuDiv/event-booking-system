'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

export const ETHIOPIA_LOCATIONS = [
  { key: 'all', label: 'All Locations' },
  { key: 'Dessie', label: 'Dessie' },
  { key: 'Addis Ababa', label: 'Addis Ababa' },
  { key: 'Hawassa', label: 'Hawassa' },
  { key: 'Bahir Dar', label: 'Bahir Dar' },
  { key: 'Bishoftu', label: 'Bishoftu' },
  { key: 'Dire Dawa', label: 'Dire Dawa' },
] as const;

export type DateFilterOption = 'all' | 'weekend' | 'next-week';

interface EventSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  dateFilter: DateFilterOption;
  onDateChange: (value: DateFilterOption) => void;
  locationFilter: string;
  onLocationChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EventSearchBar({
  searchInput,
  onSearchChange,
  dateFilter,
  onDateChange,
  locationFilter,
  onLocationChange,
  onSubmit,
}: EventSearchBarProps) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Event search and discovery"
      className="w-full bg-white dark:bg-slate-900 rounded-2xl md:rounded-full p-2 md:p-2.5 shadow-xl shadow-slate-950/15 border border-[#E4E7EC] dark:border-slate-800 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <div className="flex flex-col md:flex-row md:items-center divide-y md:divide-y-0 md:divide-x divide-[#E4E7EC] dark:divide-slate-800">
        {/* 1. Keyword / Event Name Search */}
        <div className="flex items-center gap-3 px-4 py-2.5 md:py-1.5 flex-1 group min-w-0">
          <span className="material-symbols-outlined text-[#FF6500] text-[22px] shrink-0 transition-transform group-focus-within:scale-110">
            search
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <label
              htmlFor="home-search-input"
              className="text-[10px] font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400 select-none text-left"
            >
              {t('common.search')}
            </label>
            <input
              id="home-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search concerts, festivals, conferences..."
              className="w-full bg-transparent text-[13.5px] font-semibold text-[#101828] dark:text-white placeholder:text-[#667085]/60 dark:placeholder:text-slate-500 outline-none truncate"
            />
          </div>
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-[#667085] hover:text-[#101828] dark:hover:text-white p-1 rounded-full text-xs shrink-0"
              aria-label="Clear search input"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* 2. Date Filter */}
        <div className="flex items-center gap-3 px-4 py-2.5 md:py-1.5 md:w-44 group cursor-pointer shrink-0">
          <span className="material-symbols-outlined text-[#667085] dark:text-slate-400 text-[20px] shrink-0">
            calendar_today
          </span>
          <div className="flex flex-col flex-1 min-w-0 text-left">
            <label
              htmlFor="home-date-select"
              className="text-[10px] font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400 select-none"
            >
              {t('common.date')}
            </label>
            <select
              id="home-date-select"
              value={dateFilter}
              aria-label="Filter events by date"
              onChange={(e) => onDateChange(e.target.value as DateFilterOption)}
              className="w-full bg-transparent text-[13.5px] font-semibold text-[#101828] dark:text-white outline-none cursor-pointer truncate"
            >
              <option value="all" className="dark:bg-slate-900">{t('customer.allDates')}</option>
              <option value="weekend" className="dark:bg-slate-900">{t('customer.thisWeekend')}</option>
              <option value="next-week" className="dark:bg-slate-900">{t('customer.nextWeek')}</option>
            </select>
          </div>
        </div>

        {/* 3. Location Selector */}
        <div className="flex items-center gap-3 px-4 py-2.5 md:py-1.5 md:w-48 group cursor-pointer shrink-0">
          <span className="material-symbols-outlined text-[#667085] dark:text-slate-400 text-[20px] shrink-0">
            location_on
          </span>
          <div className="flex flex-col flex-1 min-w-0 text-left">
            <label
              htmlFor="home-location-select"
              className="text-[10px] font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400 select-none"
            >
              {t('common.location')}
            </label>
            <select
              id="home-location-select"
              value={locationFilter}
              aria-label="Filter events by location"
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full bg-transparent text-[13.5px] font-semibold text-[#101828] dark:text-white outline-none cursor-pointer truncate"
            >
              {ETHIOPIA_LOCATIONS.map((loc) => (
                <option key={loc.key} value={loc.key} className="dark:bg-slate-900">
                  {loc.key === 'all' ? t('customer.allLocations') : loc.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Search CTA Button */}
        <div className="p-1 md:pl-2 shrink-0">
          <button
            type="submit"
            id="home-search-btn"
            className="w-full md:w-auto px-6 py-2.5 md:py-3 rounded-xl md:rounded-full bg-[#FF6500] hover:bg-[#E05A00] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 shadow-md shadow-[#FF6500]/25 hover:shadow-lg hover:shadow-[#FF6500]/35 transition-all duration-150 active:scale-95 shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span>{t('customer.searchBtn')}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
