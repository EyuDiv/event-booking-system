'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/home/HeroSection';
import type { DateFilterOption } from '@/components/home/EventSearchBar';
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

const MOCK_DESSIE_EVENTS: EventItem[] = [
  {
    id: 9001,
    title: 'Cultural Music Night — Dessie',
    category: 'Music',
    location: 'Piazza, Dessie',
    event_date: '2026-11-24T18:00:00',
    ticket_price: '0',
    total_tickets: 200,
    available_tickets: 150,
    status: 'active',
    image_url: null,
    description: 'An unforgettable night of traditional and modern Ethiopian music at Piazza, Dessie.',
    organizer_id: 1,
    organizer: { id: 1, name: 'Dessie Arts Hub', email: 'arts@dessie.et' },
  },
  {
    id: 9002,
    title: 'Tech Meetup @ Wollo University',
    category: 'Technology',
    location: 'Wollo University, Dessie',
    event_date: '2026-11-30T09:00:00',
    ticket_price: '50',
    total_tickets: 100,
    available_tickets: 60,
    status: 'active',
    image_url: null,
    description: 'Connect with developers, students, and innovators at Wollo University.',
    organizer_id: 2,
    organizer: { id: 2, name: 'Wollo Tech Society', email: 'tech@wollo.et' },
  },
  {
    id: 9003,
    title: 'Dessie Local Food Festival 2026',
    category: 'Food & Drinks',
    location: 'Main Square, Dessie',
    event_date: '2026-12-05T11:00:00',
    ticket_price: '100',
    total_tickets: 500,
    available_tickets: 320,
    status: 'active',
    image_url: null,
    description: 'Celebrate the rich culinary heritage of Dessie with food, music, and culture.',
    organizer_id: 3,
    organizer: { id: 3, name: 'Dessie Tourism Bureau', email: 'tourism@dessie.et' },
  },
];

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
      // Sort by ticket demand (lowest available or highest booked)
      return [...events].sort((a, b) => (a.available_tickets ?? 0) - (b.available_tickets ?? 0));
    }
    if (eventTab === 'upcoming') {
      // Sort by event date ascending
      return [...events].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
    return events;
  }, [events, eventTab]);

  return (
    <div className="bg-[#F8FAFC] dark:bg-slate-950 text-[#101828] dark:text-white min-h-screen flex flex-col font-sans transition-colors">
      {/* 1. Refined Navigation Bar */}
      <Navbar user={user} onLogout={handleLogout} activeRoute="discover" />

      {/* 2. Main Content */}
      <main className="flex-grow">
        {/* Hero Section & Floating Advanced Search Bar */}
        <HeroSection
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          dateFilter={dateFilter}
          onDateChange={setDateFilter}
          locationFilter={locationFilter}
          onLocationChange={setLocationFilter}
          onSearchSubmit={handleSearchSubmit}
        />

        {/* 3. Category Filter Navigation */}
        <CategoryNavigation
          activeCategory={category}
          onSelectCategory={setCategory}
          extraCategories={extraCategories}
          totalCount={events.length}
          loading={loading}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />

        {/* 4. Events Section: "Explore Upcoming Events" */}
        <section className="max-w-[80rem] mx-auto px-4 sm:px-6 pb-16" id="events">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-[26px] sm:text-[32px] font-black text-[#101828] dark:text-white tracking-tight">
                {t('customer.popularEvents')}
              </h2>
              <p className="text-[14px] sm:text-[15px] text-[#667085] dark:text-slate-400 mt-1 font-normal">
                {t('customer.featuredSubtitle')}
              </p>
            </div>

            {/* Sub-tabs: All, Popular, Upcoming */}
            {events.length > 1 && (
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 border border-[#E4E7EC] dark:border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setEventTab('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
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
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
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
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
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

          {/* Loading Skeletons */}
          {loading && <EventSkeletonGrid />}

          {/* Error State */}
          {!loading && error && (
            <EventErrorState message={error} onRetry={() => void loadEvents()} />
          )}

          {/* Empty State when filters return 0 matches */}
          {!loading && !error && events.length === 0 && hasActiveFilters && (
            <EventEmptyState
              hasFilters={true}
              onResetFilters={resetFilters}
              isOrganizerOrAdmin={isOrganizerOrAdmin}
            />
          )}

          {/* Empty State when DB is empty and no filters are active (show mock Dessie events as local highlight) */}
          {!loading && !error && events.length === 0 && !hasActiveFilters && (
            <>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40 text-[#FF6500] text-[12px] font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[15px]">location_on</span>
                  <span>Dessie & Northern Ethiopia • Featured Preview</span>
                </div>
                <p className="text-[13px] text-[#667085] dark:text-slate-400">
                  Real backend connected • Sample local experiences
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="mockEventsGrid">
                {MOCK_DESSIE_EVENTS.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}

          {/* Real Events Grid */}
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
