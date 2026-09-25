'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredAuth, logoutUser } from '@/lib/api';
import type { AuthUser } from '@/types/auth';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser || authUser.role !== 'super-admin') {
      router.push('/login');
      return;
    }
    setUser(authUser);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  function handleDownloadReport() {
    // Generate a clean summary CSV for Super Admin
    const dateStr = new Date().toISOString().split('T')[0];
    const csvContent = `data:text/csv;charset=utf-8,TiketHub Super Admin System Health Report - ${dateStr}\nStatus,Online\nGateway,Connected (telebirr, Chapa, CBE)\nExported At,${new Date().toISOString()}\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tikethub-system-report-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg animate-spin">
            <span className="material-symbols-outlined text-2xl">confirmation_number</span>
          </div>
          <div className="text-on-surface font-semibold text-sm animate-pulse tracking-wide">
            {t('common.loadingPortal')}
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { nameKey: 'nav.dashboard', defaultName: 'Dashboard', href: '/admin', icon: 'dashboard', badge: 'Live', badgeClass: 'bg-white/20 text-white font-bold' },
    { nameKey: 'nav.users', defaultName: 'Users', href: '/admin/users', icon: 'group', badge: 'Roster', badgeClass: 'bg-surface-container-high/20 text-outline-variant' },
    { nameKey: 'nav.events', defaultName: 'Events', href: '/admin/events', icon: 'event', badge: 'Active', badgeClass: 'bg-amber-500/20 text-amber-300 font-bold' },
    { nameKey: 'nav.bookings', defaultName: 'Bookings', href: '/admin/bookings', icon: 'receipt_long', badge: 'Ledger', badgeClass: 'bg-surface-container-high/20 text-outline-variant' },
    { nameKey: 'nav.payments', defaultName: 'Payments', href: '/admin/payments', icon: 'payments' },
    { nameKey: 'nav.refunds', defaultName: 'Refunds', href: '/admin/refunds', icon: 'currency_exchange', badge: 'Escrow', badgeClass: 'bg-rose-500/20 text-rose-300 font-bold' },
    { nameKey: 'nav.checkIn', defaultName: 'Gate Check-in', href: '/organizer/check-in', icon: 'qr_code_scanner', badge: 'Fast-Lane', badgeClass: 'bg-emerald-500/20 text-emerald-300 font-bold' },
    { nameKey: 'nav.analytics', defaultName: 'Analytics', href: '/admin/analytics', icon: 'monitoring' },
  ];

  const getPageTitle = () => {
    if (pathname === '/admin') return t('header.adminConsole');
    if (pathname.startsWith('/admin/users')) return `${t('nav.users')} - ${t('admin.userDirectory')}`;
    if (pathname.startsWith('/admin/events')) return `${t('nav.events')} - ${t('admin.reviewEvents')}`;
    if (pathname.startsWith('/admin/bookings')) return `${t('nav.bookings')} - ${t('admin.viewBookings')}`;
    if (pathname.startsWith('/admin/payments')) return `${t('nav.payments')} - ${t('admin.paymentGateways')}`;
    if (pathname.startsWith('/admin/refunds')) return `${t('nav.refunds')}`;
    if (pathname.startsWith('/admin/analytics')) return `${t('nav.analytics')}`;
    if (pathname.startsWith('/organizer/check-in')) return `${t('organizer.gateCheckIn')}`;
    return t('header.adminConsole');
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SA';

  return (
    <div className="bg-background text-on-surface antialiased flex h-screen overflow-hidden font-body-md text-body-md select-none">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== LEFT SIDEBAR ==================== */}
      <aside
        className={`w-72 bg-inverse-surface text-inverse-on-surface flex flex-col justify-between shrink-0 z-50 shadow-xl border-r border-outline/20 fixed lg:static inset-y-0 left-0 transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Branding & Platform Role */}
        <div className="p-space-lg border-b border-outline/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-on-primary shadow-lg shadow-primary/30 shrink-0">
                <span className="material-symbols-outlined text-2xl">confirmation_number</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-sm text-headline-sm font-extrabold tracking-tight text-white">TiketHub</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-on-primary">
                    {t('nav.admin')}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-outline-variant">{t('nav.platformMasterControl')}</p>
              </div>
            </div>
            {/* Close button on mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-outline-variant hover:text-white hover:bg-white/10"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Quick Switcher / Status Badge */}
          <div className="mt-4 flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-inverse-primary">Laravel API v2.4</span>
            </div>
            <span className="text-[10px] text-tertiary-fixed-dim font-bold bg-tertiary/60 px-2 py-0.5 rounded-full border border-tertiary-fixed-dim/20">
              {t('status.live').toUpperCase()}
            </span>
          </div>

          {/* Sidebar Language Switcher */}
          <div className="mt-3">
            <LanguageSwitcher variant="sidebar" />
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-outline-variant">
            {t('nav.mainEcosystem')}
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center justify-between px-space-md py-space-sm rounded-xl font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-outline-variant hover:text-white hover:bg-white/5 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="font-label-md text-label-md">{t(item.nameKey)}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white font-bold' : item.badgeClass || 'bg-surface-container-high/10 text-outline-variant'
                    }`}
                  >
                    {item.badge === 'Live' ? t('status.live') : item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-outline-variant">
            {t('nav.platformControl')}
          </div>
          <Link
            href="/admin"
            className="w-full flex items-center gap-3 px-space-md py-space-sm rounded-xl text-outline-variant hover:text-white hover:bg-white/5 font-medium transition-all duration-150"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="font-label-md text-label-md">{t('nav.settings')}</span>
          </Link>
          <Link
            href="/admin"
            className="w-full flex items-center gap-3 px-space-md py-space-sm rounded-xl text-outline-variant hover:text-white hover:bg-white/5 font-medium transition-all duration-150"
          >
            <span className="material-symbols-outlined text-xl">security</span>
            <span className="font-label-md text-label-md">{t('nav.auditLogs')}</span>
          </Link>
        </div>

        {/* Admin User Footer */}
        <div className="p-space-md border-t border-outline/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary/30 border border-inverse-primary/30 flex items-center justify-center font-bold text-white text-sm shrink-0">
                {userInitials}
              </div>
              <div className="leading-tight truncate">
                <p className="font-label-md text-label-md text-white truncate" title={user?.name || 'Super Admin'}>
                  {user?.name || 'Super Admin'}
                </p>
                <p className="text-[11px] text-tertiary-fixed-dim font-medium">{t('nav.platformMaster')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-outline-variant hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT WRAPPER ==================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* TOP HEADER */}
        <header className="h-16 border-b border-outline-variant/30 bg-surface-container-lowest px-4 sm:px-space-xl flex items-center justify-between shrink-0 shadow-xs z-20">
          {/* Breadcrumb / Console Context */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
              title="Open Navigation"
              aria-label="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>

            <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md min-w-0">
              <span className="text-on-surface-variant/80 hidden sm:inline">{t('header.console')}</span>
              <span className="material-symbols-outlined text-sm hidden sm:inline">chevron_right</span>
              <span className="text-primary font-bold truncate max-w-[120px] sm:max-w-[220px] md:max-w-none">
                {getPageTitle()}
              </span>
            </div>
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t('header.gatewayOnline')}
            </span>
          </div>

          {/* Center / Search Box */}
          <div className="w-64 lg:w-80 xl:w-96 relative hidden md:block mx-4">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">
              search
            </span>
            <input
              className="w-full pl-10 pr-12 py-2 text-sm bg-surface-container-low border border-outline-variant/40 rounded-xl focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-outline/70"
              placeholder={t('header.searchPlaceholder')}
              type="text"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-white border border-outline-variant/50 text-outline-variant px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Header Language Switcher */}
            <LanguageSwitcher variant="pill" />

            {/* Quick Action Notification Button with Popup */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors relative"
                title={t('nav.notifications')}
                aria-label={t('nav.notifications')}
              >
                <span className="material-symbols-outlined text-2xl">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-white"></span>
              </button>

              {/* Notification Dropdown Preview matching Stitch */}
              {showNotif && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-88 max-w-sm bg-white rounded-2xl shadow-2xl border border-outline-variant/30 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20 mb-2">
                    <span className="font-headline-sm text-sm font-bold text-on-surface">{t('header.urgentSystemAlerts')}</span>
                    <span
                      onClick={() => setShowNotif(false)}
                      className="text-[11px] font-bold text-primary cursor-pointer hover:underline"
                    >
                      {t('header.markAllRead')}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-amber-600 text-lg shrink-0">warning</span>
                      <div>
                        <p className="text-xs font-bold text-amber-950">Addis Jazz Fest: Capacity 98%</p>
                        <p className="text-[11px] text-amber-800">Only 24 tickets remaining in VIP lounge.</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">verified</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-950">Gate Scanner Station 04 Online</p>
                        <p className="text-[11px] text-emerald-800">Millennium Hall entrance synchronized.</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-indigo-600 text-lg shrink-0">payments</span>
                      <div>
                        <p className="text-xs font-bold text-indigo-950">telebirr & Chapa Escrow Settled</p>
                        <p className="text-[11px] text-indigo-800">All live transaction webhooks healthy.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* System CSV Download */}
            <button
              onClick={handleDownloadReport}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
              title={t('header.downloadReport')}
              aria-label={t('header.downloadReport')}
            >
              <span className="material-symbols-outlined text-2xl">cloud_download</span>
            </button>

            <div className="h-6 w-px bg-outline-variant/40 mx-1 hidden sm:block"></div>

            {/* Role Pill */}
            <div className="flex items-center gap-2.5 pl-1 sm:pl-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary text-white font-bold flex items-center justify-center text-xs shadow-md shrink-0">
                {userInitials}
              </div>
              <div className="hidden lg:flex flex-col justify-center text-left">
                <span className="block text-xs font-bold leading-tight text-on-surface">{t('header.superAdmin')}</span>
                <span className="text-[11px] text-outline-variant leading-tight">{t('header.locationTime')}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Views Container */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-space-xl space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
