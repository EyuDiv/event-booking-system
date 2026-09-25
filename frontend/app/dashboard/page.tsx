'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth, logoutUser } from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
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

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="text-[#3525cd] font-semibold text-lg animate-pulse">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#3525cd] text-[28px]">
            confirmation_number
          </span>
          <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          <span className="hidden min-[420px]:inline-block ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            {t('common.customer')}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher variant="pill" />
          <NotificationBell />
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-bold text-[#131b2e]">{user?.name}</div>
            <div className="text-[11px] text-slate-500">{user?.email}</div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            {t('nav.logout')}
          </button>
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
