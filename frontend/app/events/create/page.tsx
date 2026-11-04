'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredAuth } from '@/lib/api';
import type { AuthUser } from '@/types/auth';
import UserProfileDropdown from '@/components/UserProfileDropdown';

export default function EventsCreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.replace('/login?redirect=/organizer/events/create');
      return;
    }
    const role = (authUser.role as string) ?? '';
    if (!['organizer', 'super-admin', 'admin'].includes(role)) {
      setUser(authUser);
      setAccessDenied(true);
      setLoadingAuth(false);
      return;
    }
    // If user is organizer or admin, redirect to organizer creation studio
    router.replace('/organizer/events/create');
  }, [router]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#3525cd]/20 border-t-[#3525cd] rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">Verifying permissions…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#faf8ff] dark:bg-slate-950 flex flex-col font-sans">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-40">
          <Link href="/" className="flex items-center gap-2 text-[20px] font-extrabold text-[#3525cd] dark:text-indigo-400">
            <span className="material-symbols-outlined text-[#3525cd] text-[26px]">confirmation_number</span>
            <span>TiketHub</span>
          </Link>
          {user && <UserProfileDropdown user={user} />}
        </header>

        {/* Access Restricted Barrier */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-[36px]">shield_lock</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Organizer Access Required
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              You are signed in as <strong className="text-slate-900 dark:text-slate-200">{user?.name}</strong>{' '}
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                {user?.role === 'customer' ? 'Customer / Attendee' : user?.role}
              </span>
              . Only registered Event Organizers and Administrators have permissions to create and publish events.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#3525cd] text-white text-sm font-semibold hover:bg-[#3525cd]/90 transition-all shadow-sm active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">explore</span>
                Browse Events
              </Link>
              <Link
                href="/my-bookings"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
                View My Bookings
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

