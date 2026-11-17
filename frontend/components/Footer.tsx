'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import type { AuthUser } from '@/types/auth';

interface FooterProps {
  user?: AuthUser | null;
}

export default function Footer({ user }: FooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-[#E4E7EC] dark:border-slate-800 transition-colors">
      <div className="max-w-[80rem] mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6 w-full">
        {/* Brand & Copyright Statement */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <Link
            href="/"
            className="flex items-center gap-2 text-[20px] font-extrabold text-[#101828] dark:text-white tracking-tight"
          >
            <div className="w-7 h-7 rounded-lg bg-[#FF6500] flex items-center justify-center text-white text-[15px] shadow-xs shadow-[#FF6500]/25">
              <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
            </div>
            <span>
              Tiket<span className="text-[#FF6500]">Hub</span>
            </span>
          </Link>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <p className="text-[#667085] dark:text-slate-400 text-[13px]">
            {t('customer.footerRights')}
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-[#667085] dark:text-slate-400">
          <a
            href="#events"
            className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150"
          >
            {t('customer.exploreEvents')}
          </a>
          <Link
            href={user?.role === 'organizer' ? '/organizer/dashboard' : '/login'}
            className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150"
          >
            {t('customer.sellTickets')}
          </Link>
          <span className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150 cursor-pointer">
            {t('customer.pricingFees')}
          </span>
          <span className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150 cursor-pointer">
            {t('customer.termsOfService')}
          </span>
          <span className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150 cursor-pointer">
            {t('customer.privacyPolicy')}
          </span>
          <span className="hover:text-[#FF6500] dark:hover:text-white transition-colors duration-150 cursor-pointer">
            {t('customer.helpCenter')}
          </span>
        </div>
      </div>
    </footer>
  );
}
