'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import EventSearchBar, { type DateFilterOption } from '@/components/home/EventSearchBar';

interface HeroSectionProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  dateFilter: DateFilterOption;
  onDateChange: (value: DateFilterOption) => void;
  locationFilter: string;
  onLocationChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

export default function HeroSection({
  searchInput,
  onSearchChange,
  dateFilter,
  onDateChange,
  locationFilter,
  onLocationChange,
  onSearchSubmit,
}: HeroSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="relative max-w-[80rem] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-14 sm:pb-16">
      {/* Hero Container */}
      <div className="relative rounded-3xl bg-[#101828] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#101828] to-[#070b13] px-6 pt-12 pb-20 sm:px-10 sm:pt-16 sm:pb-24 md:pt-20 md:pb-28 text-white border border-slate-800/90 shadow-2xl overflow-visible text-center flex flex-col items-center">
        
        {/* Subtle decorative glow elements */}
        {/* Restrained warm orange glow at top-right */}
        <div
          className="absolute -top-24 right-4 w-96 h-96 bg-[#FF6500]/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        {/* Faint midnight indigo glow at bottom-left */}
        <div
          className="absolute -bottom-20 -left-12 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Faint micro geometric pattern */}
        <div
          className="absolute inset-0 rounded-3xl opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        {/* Content Container */}
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          {/* Small Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-orange-200 text-[11px] sm:text-[12px] font-bold tracking-wider uppercase mb-5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6500] animate-pulse" />
            <span>{t('customer.heroBadge')}</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-[34px] sm:text-[46px] md:text-[54px] font-black tracking-tight leading-[1.12] mb-4 text-white text-balance">
            Discover Events.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              Create Unforgettable Memories.
            </span>
          </h1>

          {/* Supporting Description */}
          <p className="text-[15px] sm:text-[17px] text-slate-300 max-w-2xl leading-relaxed mb-6 font-normal">
            {t('customer.heroSubtitle')}
          </p>
        </div>

        {/* Search Bar: Floating anchored at bottom edge */}
        <div className="absolute -bottom-10 sm:-bottom-9 left-4 right-4 sm:left-8 sm:right-8 max-w-4xl mx-auto z-20">
          <EventSearchBar
            searchInput={searchInput}
            onSearchChange={onSearchChange}
            dateFilter={dateFilter}
            onDateChange={onDateChange}
            locationFilter={locationFilter}
            onLocationChange={onLocationChange}
            onSubmit={onSearchSubmit}
          />
        </div>
      </div>
    </section>
  );
}
