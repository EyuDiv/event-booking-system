'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EventCard from '@/components/home/EventCard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from '@/lib/i18n';
import { fetchEvents, getStoredAuth, logoutUser } from '@/lib/api';
import type { AuthUser, ApiError } from '@/types/auth';
import type { EventItem } from '@/types/event';

const STITCH_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'Music', label: 'Music', icon: 'music_note' },
  { key: 'Technology', label: 'Technology', icon: 'devices' },
  { key: 'Cultural', label: 'Cultural', icon: 'theater_comedy' },
  { key: 'Food & Drinks', label: 'Food & Drinks', icon: 'restaurant' },
  { key: 'Networking', label: 'Networking', icon: 'groups' },
] as const;

const ETHIOPIA_LOCATIONS = [
  { key: 'all', label: 'All Locations' },
  { key: 'Addis Ababa', label: 'Addis Ababa' },
  { key: 'Hawassa', label: 'Hawassa' },
  { key: 'Bahir Dar', label: 'Bahir Dar' },
  { key: 'Bishoftu', label: 'Bishoftu' },
  { key: 'Dire Dawa', label: 'Dire Dawa' },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'weekend' | 'next-week'>('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync authenticated user on mount
  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (token && authUser) {
      setUser(authUser);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load real events from Laravel API
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // If location filter is set (and not 'all'), combine with keyword search for backend compatibility
      const effectiveSearch = search
        ? locationFilter !== 'all'
          ? `${search} ${locationFilter}`
          : search
        : locationFilter !== 'all'
        ? locationFilter
        : undefined;

      const response = await fetchEvents({
        search: effectiveSearch,
        category: category !== 'all' ? category : undefined,
        date_filter: dateFilter !== 'all' ? dateFilter : undefined,
      });
      setEvents(response.events ?? []);
    } catch (err) {
      const apiErr = err as ApiError;
      setEvents([]);
      setError(apiErr.message || 'Unable to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, category, dateFilter, locationFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Check for any extra dynamic categories from MySQL events
  const extraCategories = useMemo(() => {
    const known = new Set(STITCH_CATEGORIES.map((item) => item.key.toLowerCase()));
    const unique = new Set<string>();
    events.forEach((event) => {
      if (event.category && !known.has(event.category.toLowerCase())) {
        unique.add(event.category);
      }
    });
    return Array.from(unique);
  }, [events]);

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    router.push('/login');
  }

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setCategory('all');
    setLocationFilter('all');
    setDateFilter('all');
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    const grid = document.getElementById('events');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col font-sans">
      {/* ── 1. Minimal Top Navigation ────────────────────────────────────────── */}
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200/80 shadow-xs">
        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 flex justify-between items-center h-16 w-full gap-4">
          {/* Brand & Main Nav Links */}
          <div className="flex items-center gap-8 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 text-[22px] font-extrabold text-[#3525cd] tracking-tight transition-all duration-200 active:scale-95 shrink-0"
            >
              <span
                className="material-symbols-outlined text-[#3525cd] text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                confirmation_number
              </span>
              <span>TiketHub</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-[#3525cd] font-bold text-[14px] transition-all duration-200 relative py-1 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#3525cd] after:rounded-full"
              >
                {t('nav.discover')}
              </Link>
              <Link
                href={user ? '/my-bookings' : '/login'}
                className="text-slate-600 font-medium hover:text-[#3525cd] text-[14px] transition-colors duration-150"
              >
                {t('nav.myBookings')}
              </Link>
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : user?.role === 'super-admin'
                    ? '/admin'
                    : '/login'
                }
                className="text-slate-600 font-medium hover:text-[#3525cd] text-[14px] transition-colors duration-150"
              >
                {t('nav.organizerHub')}
              </Link>
            </nav>
          </div>

          {/* Right Header Action Cluster */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Language Switcher Dropdown */}
            <div className="hidden sm:block">
              <LanguageSwitcher variant="pill" />
            </div>

            {/* Notifications Button */}
            {user && (
              <Link
                href="/notifications"
                aria-label={t('nav.notifications')}
                className="p-2 text-slate-600 hover:text-[#3525cd] hover:bg-slate-50 rounded-xl transition-colors duration-150 active:scale-95 hidden sm:inline-flex"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
              </Link>
            )}

            {/* Saved Bookings / Tickets Icon */}
            <Link
              href={user ? '/my-bookings' : '/login'}
              aria-label="My Tickets"
              className="p-2 text-slate-600 hover:text-[#3525cd] hover:bg-slate-50 rounded-xl transition-colors duration-150 active:scale-95 hidden sm:inline-flex"
            >
              <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Create Event CTA */}
            <Link
              href={
                user?.role === 'organizer'
                  ? '/organizer/events/create'
                  : user?.role === 'super-admin'
                  ? '/admin'
                  : '/login'
              }
              className="hidden lg:inline-flex items-center justify-center text-[13px] font-semibold px-3.5 py-2 rounded-xl text-[#3525cd] border border-[#3525cd]/20 hover:bg-[#3525cd]/5 transition-colors duration-150 active:scale-95"
            >
              {t('nav.createEvent')}
            </Link>

            {/* Auth Profile / Sign In */}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-[13px] font-bold text-[#131b2e] leading-tight" id="user-display-name">
                    {user.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 capitalize" id="user-display-role">
                    {user.role}
                  </div>
                </div>
                <button
                  id="logout-btn"
                  type="button"
                  onClick={handleLogout}
                  className="hidden sm:inline-flex items-center justify-center text-[13px] font-semibold px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all duration-150 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">logout</span>
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <Link
                id="signin-btn"
                href="/login"
                className="inline-flex items-center justify-center text-[13px] font-bold px-3 sm:px-4 py-2 rounded-xl bg-[#3525cd] text-white hover:bg-[#3525cd]/90 shadow-sm transition-all duration-150 active:scale-95"
              >
                {t('nav.signIn')}
              </Link>
            )}

            {/* Mobile Navigation Toggle */}
            <button
              type="button"
              className="md:hidden p-2 text-slate-600 hover:text-[#3525cd] rounded-xl hover:bg-slate-100"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 px-4 py-4 space-y-3 bg-white shadow-xl animate-in fade-in duration-150">
            {/* User Profile Summary on Mobile */}
            {user ? (
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#f2f3ff] text-[#3525cd] font-bold text-xs flex items-center justify-center border border-[#3525cd]/20 shrink-0">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#131b2e] truncate">{user.name}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{user.role}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    void handleLogout();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">logout</span>
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Link
                  href="/login"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex-1 py-2 text-center text-[13px] font-bold rounded-xl bg-[#3525cd] text-white"
                >
                  {t('nav.signIn')}
                </Link>
              </div>
            )}

            {/* Mobile Language Switcher Row */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[13px] font-semibold text-slate-600">{t('common.language')}</span>
              <LanguageSwitcher variant="pill" />
            </div>

            <nav className="flex flex-col gap-1 pt-1">
              <Link
                href="/"
                className="text-[#3525cd] font-bold py-2 px-3 rounded-lg bg-[#3525cd]/5 text-[14px]"
                onClick={() => setMobileNavOpen(false)}
              >
                {t('nav.discover')}
              </Link>
              <Link
                href={user ? '/my-bookings' : '/login'}
                className="text-slate-700 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 text-[14px]"
                onClick={() => setMobileNavOpen(false)}
              >
                {t('nav.myBookings')}
              </Link>
              <Link
                href={
                  user?.role === 'organizer'
                    ? '/organizer/dashboard'
                    : user?.role === 'super-admin'
                    ? '/admin'
                    : '/login'
                }
                className="text-slate-700 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 text-[14px]"
                onClick={() => setMobileNavOpen(false)}
              >
                {t('nav.organizerHub')}
              </Link>
              {user && (
                <Link
                  href="/notifications"
                  className="text-slate-700 font-medium py-2 px-3 rounded-lg hover:bg-slate-50 text-[14px]"
                  onClick={() => setMobileNavOpen(false)}
                >
                  {t('nav.notifications')}
                </Link>
              )}
              {user && (user.role === 'organizer' || user.role === 'super-admin') && (
                <Link
                  href={user.role === 'organizer' ? '/organizer/events/create' : '/admin'}
                  className="text-[#3525cd] font-semibold py-2 px-3 rounded-lg hover:bg-[#3525cd]/5 text-[14px] flex items-center gap-1.5"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  {t('nav.createEvent')}
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-grow">
        {/* ── 2. Hero Section: Clean, Strong & Modern ───────────────────────── */}
        <section className="max-w-[80rem] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#3525cd] via-[#4338ca] to-[#6d28d9] px-6 py-12 sm:px-12 sm:py-16 md:py-20 text-white shadow-xl">
            {/* Ambient Background Accents */}
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#8a4cfc]/30 blur-3xl pointer-events-none" />
            <div className="absolute left-1/4 bottom-0 w-72 h-72 rounded-full bg-[#38bdf8]/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-[13px] font-semibold mb-5 shadow-xs">
                <span className="material-symbols-outlined text-[#6ffbbe] text-[18px]">local_fire_department</span>
                <span>{t('customer.heroBadge')}</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-[34px] sm:text-[44px] md:text-[52px] font-extrabold tracking-tight leading-[1.15] mb-4">
                {t('customer.heroTitle')}
              </h1>

              {/* Supporting Subtitle */}
              <p className="text-[15px] sm:text-[17px] leading-relaxed text-indigo-100/90 max-w-2xl mb-8">
                {t('customer.heroSubtitle')}
              </p>

              {/* ── 3. Integrated Event Search Bar ─────────────────────────── */}
              <form
                onSubmit={handleSearchSubmit}
                className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-2.5 sm:p-3 text-slate-800 border border-white/40 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3 items-center"
              >
                {/* 1. Keyword Search */}
                <div className="md:col-span-4 flex items-center gap-2.5 px-3 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors border border-slate-100">
                  <span className="material-symbols-outlined text-[#3525cd] text-[20px] shrink-0">search</span>
                  <input
                    id="home-search-input"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t('customer.searchEventsPlaceholder')}
                    className="w-full bg-transparent text-[13px] font-medium text-[#131b2e] placeholder:text-slate-400 outline-none"
                  />
                </div>

                {/* 2. Date Filter */}
                <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors border border-slate-100">
                  <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">calendar_today</span>
                  <select
                    id="home-date-select"
                    value={dateFilter}
                    aria-label="Filter events by date"
                    onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                    className="w-full bg-transparent text-[13px] font-medium text-[#131b2e] outline-none cursor-pointer"
                  >
                    <option value="all">{t('customer.allDates')}</option>
                    <option value="weekend">{t('customer.thisWeekend')}</option>
                    <option value="next-week">{t('customer.nextWeek')}</option>
                  </select>
                </div>

                {/* 3. Location Filter */}
                <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl transition-colors border border-slate-100">
                  <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">location_on</span>
                  <select
                    id="home-location-select"
                    value={locationFilter}
                    aria-label="Filter events by location"
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full bg-transparent text-[13px] font-medium text-[#131b2e] outline-none cursor-pointer truncate"
                  >
                    {ETHIOPIA_LOCATIONS.map((loc) => (
                      <option key={loc.key} value={loc.key}>
                        {loc.key === 'all' ? t('customer.allLocations') : loc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Search CTA Button */}
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    id="home-search-btn"
                    className="w-full h-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#3525cd]/90 text-white font-bold text-[13px] shadow-sm transition-all duration-150 active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">search</span>
                    <span>{t('customer.searchBtn')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* ── 4. Category Filter Pills ────────────────────────────────────────── */}
        <section className="max-w-[80rem] mx-auto px-4 sm:px-6 mb-8" id="categories">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            {/* Category Filter Pills Container */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" id="categoryFilterContainer">
              {STITCH_CATEGORIES.map((item) => {
                const active = category === item.key || (item.key === 'all' && category === 'all');
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-filter={item.key}
                    onClick={() => setCategory(item.key)}
                    className={`category-filter-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-[13px] transition-all duration-150 active:scale-95 cursor-pointer ${
                      active
                        ? 'bg-[#3525cd] text-white font-bold shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-[#3525cd] border border-slate-200 font-medium'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span>{t(`categories.${item.key}`)}</span>
                  </button>
                );
              })}

              {/* Any extra dynamic categories in DB */}
              {extraCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-filter={item}
                  onClick={() => setCategory(item)}
                  className={`category-filter-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-[13px] transition-all duration-150 active:scale-95 cursor-pointer ${
                    category === item
                      ? 'bg-[#3525cd] text-white font-bold shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-[#3525cd] border border-slate-200 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">local_activity</span>
                  <span>{item}</span>
                </button>
              ))}
            </div>

            {/* Filter Count & Quick Reset Indicator */}
            <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
              <span className="text-[13px] font-medium text-slate-500" id="eventsCountText">
                {t('customer.showingVerifiedEvents', { count: loading ? '…' : events.length })}
              </span>
              {(search || category !== 'all' || dateFilter !== 'all' || locationFilter !== 'all') && (
                <button
                  type="button"
                  id="resetFilterHeaderBtn"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#3525cd] hover:text-[#3525cd]/80 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">restart_alt</span>
                  <span>{t('customer.resetFilter')}</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── 5. Popular / Featured Events Grid ──────────────────────────────── */}
        <section className="max-w-[80rem] mx-auto px-4 sm:px-6 pb-16" id="events">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[26px] sm:text-[30px] font-extrabold text-[#131b2e] tracking-tight">
                {t('customer.popularEvents')}
              </h2>
              <p className="text-[14px] text-slate-500 mt-1">
                {t('customer.featuredSubtitle')}
              </p>
            </div>
          </div>

          {/* Loading Skeletons */}
          {loading && (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              aria-busy="true"
              id="loadingSkeletonGrid"
            >
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[16/10] bg-slate-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                    <div className="h-5 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="h-5 w-20 bg-slate-200 rounded" />
                    <div className="h-9 w-28 bg-slate-200 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div
              id="errorState"
              className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white border border-rose-200 rounded-2xl shadow-xs"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4 text-rose-600">
                <span className="material-symbols-outlined text-[36px]">error</span>
              </div>
              <h3 className="text-[18px] font-bold text-[#131b2e] mb-1">{t('common.unableToLoadEvents')}</h3>
              <p className="text-[14px] text-slate-500 max-w-md mb-6">{error}</p>
              <button
                type="button"
                onClick={() => void loadEvents()}
                className="inline-flex items-center gap-2 bg-[#3525cd] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl hover:bg-[#3525cd]/90 transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>{t('common.tryAgain')}</span>
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && events.length === 0 && (
            <div
              id="emptyState"
              className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
                <span className="material-symbols-outlined text-[36px]">event_busy</span>
              </div>
              <h3 className="text-[18px] font-bold text-[#131b2e] mb-1">{t('common.noEventsFound')}</h3>
              <p className="text-[14px] text-slate-500 max-w-md mb-6">
                {search || category !== 'all' || dateFilter !== 'all' || locationFilter !== 'all'
                  ? "We couldn't find any events matching your selected criteria. Try adjusting your search or clearing the filters."
                  : 'There are no active public events in the database yet.'}
              </p>
              <button
                id="resetFilterBtn"
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 bg-[#3525cd] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl shadow-sm hover:bg-[#3525cd]/90 transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span>{t('customer.resetFilter')}</span>
              </button>
            </div>
          )}

          {/* Real Events Grid */}
          {!loading && !error && events.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="eventsGrid">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* ── 6. Trust & Security Banner ─────────────────────────────────────── */}
        <section className="bg-white py-14 border-y border-slate-200/80">
          <div className="max-w-[80rem] mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="p-3 bg-[#f2f3ff] rounded-xl text-[#3525cd] shrink-0 border border-[#3525cd]/15">
                  <span className="material-symbols-outlined text-[28px]">bolt</span>
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[#131b2e]">{t('customer.instantPayTitle')}</h4>
                  <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    {t('customer.instantPayDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="p-3 bg-[#f2f3ff] rounded-xl text-[#3525cd] shrink-0 border border-[#3525cd]/15">
                  <span className="material-symbols-outlined text-[28px]">verified_user</span>
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[#131b2e]">{t('customer.antiFraudTitle')}</h4>
                  <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    {t('customer.antiFraudDesc')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="p-3 bg-[#f2f3ff] rounded-xl text-[#3525cd] shrink-0 border border-[#3525cd]/15">
                  <span className="material-symbols-outlined text-[28px]">support_agent</span>
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[#131b2e]">{t('customer.supportTitle')}</h4>
                  <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    {t('customer.supportDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 7. Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-50 border-t border-slate-200/80">
        <div className="max-w-[80rem] mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-4 w-full">
          {/* Brand & Copyright Statement */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <Link href="/" className="text-[20px] font-extrabold text-[#3525cd] tracking-tight">
              TiketHub
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <p className="text-slate-500 text-[13px]">
              {t('customer.footerRights')}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold text-slate-600">
            <a href="#events" className="hover:text-[#3525cd] transition-colors duration-150">
              {t('customer.exploreEvents')}
            </a>
            <Link
              href={user?.role === 'organizer' ? '/organizer/dashboard' : '/login'}
              className="hover:text-[#3525cd] transition-colors duration-150"
            >
              {t('customer.sellTickets')}
            </Link>
            <span className="hover:text-[#3525cd] transition-colors duration-150 cursor-pointer">
              {t('customer.pricingFees')}
            </span>
            <span className="hover:text-[#3525cd] transition-colors duration-150 cursor-pointer">
              {t('customer.termsOfService')}
            </span>
            <span className="hover:text-[#3525cd] transition-colors duration-150 cursor-pointer">
              {t('customer.privacyPolicy')}
            </span>
            <span className="hover:text-[#3525cd] transition-colors duration-150 cursor-pointer">
              {t('customer.helpCenter')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
