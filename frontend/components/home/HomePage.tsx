'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/home/HeroSection';
import EventSearchBar, { type DateFilterOption } from '@/components/home/EventSearchBar';
import CategoryNavigation, { DEFAULT_CATEGORIES } from '@/components/home/CategoryNavigation';
import EventCard from '@/components/home/EventCard';
import EventSkeletonGrid from '@/components/home/EventSkeletonGrid';
import EventEmptyState from '@/components/home/EventEmptyState';
import EventErrorState from '@/components/home/EventErrorState';
import TrustSection from '@/components/home/TrustSection';
import Footer from '@/components/Footer';
import { useTranslation } from '@/lib/i18n';
import { fetchEvents, getStoredAuth, logoutUser } from '@/lib/api';
import type { AuthUser, ApiError } from '@/types/auth';
import type { EventItem } from '@/types/event';

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
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [eventTab, setEventTab] = useState<'all' | 'popular' | 'upcoming'>('all');

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

  // Load real events from Laravel REST API
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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
      setError(apiErr.message || 'Unable to connect to the server. Please verify the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [search, category, dateFilter, locationFilter]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Discover any dynamic categories from MySQL events
  const extraCategories = useMemo(() => {
    const known = new Set(DEFAULT_CATEGORIES.map((item) => item.key.toLowerCase()));
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

  const hasActiveFilters = Boolean(
    search || category !== 'all' || dateFilter !== 'all' || locationFilter !== 'all'
  );

  const isOrganizerOrAdmin = Boolean(
    user && (user.role === 'organizer' || user.role === 'super-admin' || (user.role as string) === 'admin')
  );

  // Filtered/Sorted list for the Discovery section tabs
  const displayedEvents = useMemo(() => {
    if (eventTab === 'all') return events;
    if (eventTab === 'popular') {
      return [...events].sort((a, b) => (a.available_tickets ?? 0) - (b.available_tickets ?? 0));
    }
    if (eventTab === 'upcoming') {
      return [...events].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
    return events;
  }, [events, eventTab]);

  return (
    <div className="bg-[#F8FAFC] dark:bg-slate-950 text-[#101828] dark:text-white min-h-screen flex flex-col font-sans transition-colors">
      {/* 1. Navigation Bar */}
      <Navbar user={user} onLogout={handleLogout} activeRoute="discover" />

      {/* 2. Main Content */}
      <main className="flex-grow">
        {/* Compact, Balanced Hero Section */}
        <HeroSection />

        {/* Floating Search Bar: Anchored with balanced overlap */}
        <div className="relative z-20 -mt-7 sm:-mt-8 max-w-4xl mx-auto px-4 sm:px-6">
          <EventSearchBar
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            dateFilter={dateFilter}
            onDateChange={setDateFilter}
            locationFilter={locationFilter}
            onLocationChange={setLocationFilter}
            onSubmit={handleSearchSubmit}
          />
        </div>

        {/* 3. Category Navigation with Tightened Vertical Spacing */}
        <CategoryNavigation
          activeCategory={category}
          onSelectCategory={setCategory}
          extraCategories={extraCategories}
          totalCount={events.length}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />

        {/* 4. Events Discovery: "Explore Upcoming Events" */}
        <section className="max-w-[80rem] mx-auto px-4 sm:px-6 pt-4 pb-14" id="events">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-[24px] sm:text-[28px] font-black text-[#101828] dark:text-white tracking-tight">
                {t('customer.popularEvents')}
              </h2>
              <p className="text-[14px] text-[#667085] dark:text-slate-400 mt-0.5 font-normal">
                {t('customer.featuredSubtitle')}
              </p>
            </div>

            {/* Sub-tabs: All, Popular, Upcoming (when events exist) */}
            {events.length > 1 && (
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-[#E4E7EC] dark:border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEventTab('all')}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
                    eventTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-[#101828] dark:text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t('common.all')}
                </button>
                <button
                  type="button"
                  onClick={() => setEventTab('popular')}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
                    eventTab === 'popular'
                      ? 'bg-white dark:bg-slate-900 text-[#101828] dark:text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Popular
                </button>
                <button
                  type="button"
                  onClick={() => setEventTab('upcoming')}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
                    eventTab === 'upcoming'
                      ? 'bg-white dark:bg-slate-900 text-[#101828] dark:text-white shadow-xs'
                      : 'text-[#667085] hover:text-[#101828] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Upcoming
                </button>
              </div>
            )}
          </div>

          {/* State A: Loading Skeletons */}
          {loading && <EventSkeletonGrid />}

          {/* State B: Real API Request Failure */}
          {!loading && error && (
            <EventErrorState message={error} onRetry={() => void loadEvents()} />
          )}

          {/* State C: API Success with Zero Events */}
          {!loading && !error && events.length === 0 && (
            <EventEmptyState
              hasFilters={hasActiveFilters}
              onResetFilters={resetFilters}
              isOrganizerOrAdmin={isOrganizerOrAdmin}
            />
          )}

          {/* State D: Real Events Grid */}
          {!loading && !error && events.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="eventsGrid">
              {displayedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Trust & Security Section */}
        <TrustSection />
      </main>

      {/* 6. Footer */}
      <Footer user={user} />
    </div>
  );
}
