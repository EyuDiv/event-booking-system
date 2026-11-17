'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { useTranslation } from '@/lib/i18n';
import type { AuthUser } from '@/types/auth';

interface NavbarProps {
  user: AuthUser | null;
  onLogout: () => void | Promise<void>;
  activeRoute?: 'discover' | 'my-bookings' | string;
}

export default function Navbar({ user, onLogout, activeRoute = 'discover' }: NavbarProps) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOrganizerOrAdmin = Boolean(
    user && (user.role === 'organizer' || user.role === 'super-admin' || (user.role as string) === 'admin')
  );

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-[#E4E7EC] dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[80rem] mx-auto px-4 sm:px-6 flex justify-between items-center h-16 w-full gap-4">
        {/* Left: Brand Logo & Wordmark */}
        <div className="flex items-center gap-8 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-transform duration-150 active:scale-95 shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#FF6500] text-white flex items-center justify-center shadow-xs shadow-[#FF6500]/25 group-hover:scale-105 transition-transform">
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                confirmation_number
              </span>
            </div>
            <span className="text-[21px] font-extrabold text-[#101828] dark:text-white tracking-tight">
              Tiket<span className="text-[#FF6500]">Hub</span>
            </span>
          </Link>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            <Link
              href="/"
              className={`text-[14px] font-semibold transition-colors py-1 relative ${
                activeRoute === 'discover'
                  ? 'text-[#101828] dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#FF6500] after:rounded-full'
                  : 'text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t('nav.discover')}
            </Link>
            <Link
              href={user ? '/my-bookings' : '/login'}
              className={`text-[14px] font-semibold transition-colors py-1 relative ${
                activeRoute === 'my-bookings'
                  ? 'text-[#101828] dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#FF6500] after:rounded-full'
                  : 'text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t('nav.myBookings')}
            </Link>
            {(!user || isOrganizerOrAdmin) && (
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : isOrganizerOrAdmin
                    ? '/admin'
                    : '/login'
                }
                className="text-[14px] font-medium text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                {t('nav.organizerHub')}
              </Link>
            )}
          </nav>
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher */}
          <div className="hidden sm:block">
            <LanguageSwitcher variant="pill" />
          </div>

          {/* Notifications */}
          {user && (
            <div className="flex items-center">
              <NotificationBell />
            </div>
          )}

          {/* My Tickets Shortcut */}
          <Link
            href={user ? '/my-bookings' : '/login'}
            aria-label="My Tickets"
            title="My Tickets"
            className="p-2 text-[#667085] dark:text-slate-400 hover:text-[#101828] dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-xl transition-colors duration-150 active:scale-95 hidden sm:inline-flex"
          >
            <span className="material-symbols-outlined text-[20px]">confirmation_number</span>
          </Link>

          {/* Create Event CTA for Organizers / Admins */}
          {isOrganizerOrAdmin && (
            <>
              <div className="h-5 w-px bg-[#E4E7EC] dark:bg-slate-800 mx-1 hidden lg:block" />
              <Link
                href={user?.role === 'organizer' ? '/organizer/events/create' : '/admin'}
                className="hidden lg:inline-flex items-center justify-center text-[13px] font-semibold px-3.5 py-2 rounded-xl text-[#101828] dark:text-slate-200 border border-[#E4E7EC] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px] mr-1.5 text-[#FF6500]">add_circle</span>
                {t('nav.createEvent')}
              </Link>
            </>
          )}

          {/* User Profile Dropdown or Sign In Button */}
          {user ? (
            <UserProfileDropdown user={user} />
          ) : (
            <Link
              id="signin-btn"
              href="/login"
              className="inline-flex items-center justify-center text-[13px] font-bold px-4 py-2 rounded-xl bg-[#FF6500] hover:bg-[#E05A00] text-white shadow-xs shadow-[#FF6500]/25 transition-all duration-150 active:scale-95"
            >
              {t('nav.signIn')}
            </Link>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="md:hidden p-2 text-[#667085] dark:text-slate-400 hover:text-[#101828] dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E4E7EC] dark:border-slate-800 px-4 py-4 space-y-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl animate-in fade-in duration-150">
          {/* User Profile summary on mobile */}
          {user ? (
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC] dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FF6500] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#101828] dark:text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-[#667085] dark:text-slate-400 capitalize">{user.role}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void onLogout();
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">logout</span>
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pb-3 border-b border-[#E4E7EC] dark:border-slate-800">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 py-2 text-center text-[13px] font-bold rounded-xl bg-[#FF6500] hover:bg-[#E05A00] text-white shadow-xs"
              >
                {t('nav.signIn')}
              </Link>
            </div>
          )}

          {/* Mobile Language Switcher Row */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC] dark:border-slate-800">
            <span className="text-[13px] font-semibold text-[#667085] dark:text-slate-300">{t('common.language')}</span>
            <LanguageSwitcher variant="pill" />
          </div>

          <nav className="flex flex-col gap-1 pt-1">
            <Link
              href="/"
              className={`font-semibold py-2 px-3 rounded-lg text-[14px] ${
                activeRoute === 'discover'
                  ? 'text-[#FF6500] bg-orange-50/60 dark:bg-orange-950/30'
                  : 'text-[#101828] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {t('nav.discover')}
            </Link>
            <Link
              href={user ? '/my-bookings' : '/login'}
              className="text-[#101828] dark:text-slate-300 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[14px]"
              onClick={() => setMobileOpen(false)}
            >
              {t('nav.myBookings')}
            </Link>
            {(!user || isOrganizerOrAdmin) && (
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : isOrganizerOrAdmin
                    ? '/admin'
                    : '/login'
                }
                className="text-[#101828] dark:text-slate-300 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[14px]"
                onClick={() => setMobileOpen(false)}
              >
                {t('nav.organizerHub')}
              </Link>
            )}
            {user && (
              <Link
                href="/notifications"
                className="text-[#101828] dark:text-slate-300 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[14px] flex items-center justify-between"
                onClick={() => setMobileOpen(false)}
              >
                <span>{t('nav.notifications')}</span>
              </Link>
            )}
            {isOrganizerOrAdmin && (
              <Link
                href={user?.role === 'organizer' ? '/organizer/events/create' : '/admin'}
                className="text-[#FF6500] font-semibold py-2 px-3 rounded-lg hover:bg-orange-50/60 dark:hover:bg-orange-950/30 text-[14px] flex items-center gap-1.5"
                onClick={() => setMobileOpen(false)}
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                {t('nav.createEvent')}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
