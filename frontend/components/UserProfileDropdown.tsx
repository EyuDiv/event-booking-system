'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logoutUser } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

interface UserProfileDropdownProps {
  user: AuthUser;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  'super-admin': {
    label: 'Super Admin',
    color: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-700/60 dark:border-slate-300',
    icon: 'admin_panel_settings',
  },
  'admin': {
    label: 'Administrator',
    color: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-700/60 dark:border-slate-300',
    icon: 'admin_panel_settings',
  },
  'organizer': {
    label: 'Organizer',
    color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40',
    icon: 'campaign',
  },
  'customer': {
    label: 'Customer',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    icon: 'confirmation_number',
  },
  'attendee': {
    label: 'Attendee',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    icon: 'confirmation_number',
  },
};

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserProfileDropdown({ user }: UserProfileDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize and persist dark mode
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      // Proceed with redirection even if network fails
    } finally {
      router.push('/login');
    }
  }

  const roleInfo = ROLE_CONFIG[user.role as string] ?? {
    label: user.role,
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    icon: 'person',
  };

  const initials = getInitials(user.name);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* ── Refined Airbnb / Eventbrite Style Trigger Button ── */}
      <button
        id="user-profile-btn"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 p-1 sm:pl-1.5 sm:pr-3 sm:py-1 rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-150 shadow-xs cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#f97316]/20"
        title="Profile and Settings"
      >
        {/* User Avatar with Initials */}
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#f97316] to-[#ea580c] flex items-center justify-center text-white text-[12px] font-bold tracking-tight shadow-sm shadow-orange-500/20">
            {initials}
          </div>
          {/* Active online status dot (#10B981) */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10b981] ring-2 ring-white dark:ring-slate-800" />
        </div>

        {/* User Name & Role */}
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-[13px] font-bold text-[#0f172a] dark:text-slate-100 truncate max-w-[110px]">
            {user.name}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium capitalize">
            {roleInfo.label}
          </span>
        </div>

        <span
          className={`material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-transform duration-200 ${
            open ? 'rotate-180 text-[#f97316]' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* ── Dropdown Menu Popover ── */}
      <div
        role="menu"
        aria-orientation="vertical"
        className={`absolute right-0 mt-2 w-76 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/40 z-50 overflow-hidden transition-all duration-200 origin-top-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* User Information & Status Section */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-start gap-3">
            {/* Expanded Avatar */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#f97316] to-[#ea580c] flex items-center justify-center text-white text-[15px] font-bold shadow-sm shadow-orange-500/25 shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-bold text-[#0f172a] dark:text-white truncate leading-snug">
                {user.name}
              </h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={user.email}>
                {user.email}
              </p>

              {/* Status and Role Badges */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {/* Account Active Indicator with #10B981 */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                  Active Account
                </span>

                {/* Role Badge */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${roleInfo.color}`}>
                  <span className="material-symbols-outlined text-[12px]">
                    {roleInfo.icon}
                  </span>
                  {roleInfo.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Navigation Items */}
        <div className="py-2 px-1.5 space-y-0.5">
          {/* Dark Mode Switcher */}
          <div
            role="menuitem"
            tabIndex={0}
            onClick={toggleDarkMode}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDarkMode(); }}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-[#f97316] transition-colors">
                <span className="material-symbols-outlined text-[19px]">
                  {darkMode ? 'light_mode' : 'dark_mode'}
                </span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#0f172a] dark:text-slate-100 leading-tight">
                  Theme
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {darkMode ? 'Dark mode active' : 'Light mode active'}
                </div>
              </div>
            </div>

            {/* Toggle Pill Switch */}
            <div
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out shrink-0 ${
                darkMode ? 'bg-[#f97316]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out flex items-center justify-center ${
                  darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              >
                <span className={`material-symbols-outlined text-[12px] ${darkMode ? 'text-orange-600' : 'text-amber-500'}`}>
                  {darkMode ? 'dark_mode' : 'light_mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              if (user.role === 'organizer') {
                router.push('/organizer/dashboard');
              } else if (user.role === 'super-admin' || (user.role as string) === 'admin') {
                router.push('/admin');
              } else {
                router.push('/dashboard');
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-[#f97316] transition-colors">
              <span className="material-symbols-outlined text-[19px]">
                settings
              </span>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0f172a] dark:text-slate-100 leading-tight">
                Account Settings
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Profile preferences & credentials
              </div>
            </div>
          </button>

          {/* Conditional Role Shortcut Links */}
          {(user.role === 'customer' || (user.role as string) === 'attendee') && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/my-bookings');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-[#f97316] transition-colors">
                <span className="material-symbols-outlined text-[19px]">
                  receipt_long
                </span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#0f172a] dark:text-slate-100 leading-tight">
                  My Bookings
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tickets, QR codes & invoices
                </div>
              </div>
            </button>
          )}

          {user.role === 'organizer' && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/organizer/events/create');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors text-left group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-[#f97316] transition-colors">
                <span className="material-symbols-outlined text-[19px]">
                  add_circle
                </span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#0f172a] dark:text-slate-100 leading-tight">
                  Create New Event
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Publish a new concert or summit
                </div>
              </div>
            </button>
          )}
        </div>

        {/* ── Log Out Button Section ── */}
        <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            id="dropdown-logout-btn"
            role="menuitem"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-100/70 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </div>
            <span>{loggingOut ? 'Signing out…' : 'Log Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
