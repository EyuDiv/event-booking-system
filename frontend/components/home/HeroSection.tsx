'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative max-w-[80rem] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
      {/* Hero Box */}
      <div className="relative rounded-3xl bg-[#101828] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#101828] to-[#070b13] px-6 pt-9 pb-16 sm:px-10 sm:pt-12 sm:pb-20 md:pt-14 md:pb-22 text-white border border-slate-800/90 shadow-2xl overflow-hidden text-center flex flex-col items-center">
        
        {/* Subtle decorative glow elements */}
        <div
          className="absolute -top-24 right-4 w-96 h-96 bg-[#FF6500]/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-20 -left-12 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Faint micro pattern */}
        <div
          className="absolute inset-0 rounded-3xl opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        {/* Content Container */}
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          {/* Small Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-orange-200 text-[11px] sm:text-[12px] font-bold tracking-wider uppercase mb-3.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6500] animate-pulse" />
            <span>{t('customer.heroBadge')}</span>
          </div>

          {/* Main Headline - Solid crisp text, no ghosting or duplicate text artifacts */}
          <h1 className="text-[30px] sm:text-[40px] md:text-[46px] font-black tracking-tight leading-[1.14] mb-3 text-white">
            Discover Events.
            <br />
            <span className="text-slate-100 font-extrabold">
              Create Unforgettable Memories.
            </span>
          </h1>

          {/* Supporting Description */}
          <p className="text-[14px] sm:text-[16px] text-slate-300 max-w-xl leading-relaxed font-normal">
            {t('customer.heroSubtitle')}
          </p>
        </div>
      </div>
    </section>
  );
}
