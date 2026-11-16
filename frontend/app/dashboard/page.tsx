'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredAuth } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { AuthUser } from '@/types/auth';

export default function CustomerDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login');
      return;
    }
    setUser(authUser);
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-[#3525cd] font-semibold text-lg animate-pulse">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#f97316] to-[#ea580c] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            </div>
            <span className="text-[20px] font-extrabold text-[#0f172a] dark:text-white tracking-tight">
              Tiket<span className="text-[#f97316]">Hub</span>
            </span>
          </Link>
          <span className="hidden min-[420px]:inline-block ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            {t('common.customer')}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher variant="pill" />
          <NotificationBell />
          {user && <UserProfileDropdown user={user} />}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full p-6 sm:p-10 flex-grow">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 tier-2-shadow mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-[#131b2e]">
                {t('customer.welcomeUser', { name: user?.name || '' })}
              </h1>
              <p className="text-[14px] text-slate-600">
                {t('customer.welcomeCustomerDesc')}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-4 text-[13px]">
            <div>
              <span className="font-semibold text-slate-700">{t('customer.userId')}:</span>{' '}
              <span className="text-slate-900 font-mono">{user?.id}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">{t('common.email')}:</span>{' '}
              <span className="text-slate-900">{user?.email}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">{t('common.role')}:</span>{' '}
              <span className="text-slate-900 font-mono">{user?.role}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">{t('customer.tokenStatus')}:</span>{' '}
              <span className="text-emerald-700 font-semibold">{t('customer.activeToken')}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[13px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#3525cd]">info</span>
          <span>
            <strong>Phase 1 Complete:</strong> Customer Authentication and Role Redirection verified. Next module: Event Discovery and Booking.
          </span>
        </div>
      </main>
    </div>
  );
}
