'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredAuth, logoutUser, fetchOrganizerEvents, deleteOrganizerEvent } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { AuthUser } from '@/types/auth';
import type { EventItem } from '@/types/event';
import type { ApiError } from '@/types/auth';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: t('status.active'),   cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    draft:    { label: t('status.draft'),    cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
    sold_out: { label: t('status.soldOut'),  cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[36px] text-[#712ae2]">event_note</span>
      </div>
      <h2 className="text-[18px] font-bold text-[#131b2e] mb-2">{t('common.noEventsFound')}</h2>
      <p className="text-[14px] text-slate-500 mb-6 max-w-sm">
        {t('organizer.emptyEventsDesc')}
      </p>
      <Link
        href="/organizer/events/create"
        id="create-first-event-btn"
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#712ae2] to-[#3525cd] text-white font-bold text-[14px] flex items-center gap-2 hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-[18px]">add_circle</span>
        {t('organizer.createEvent')}
      </Link>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

interface EventCardProps {
  event: EventItem;
  onDelete: (id: number) => void;
  deleting: boolean;
}

function EventCard({ event, onDelete, deleting }: EventCardProps) {
  const { t } = useTranslation();
  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—';

  const soldPercent =
    event.total_tickets > 0
      ? Math.round(((event.total_tickets - event.available_tickets) / event.total_tickets) * 100)
      : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-purple-300 hover:shadow-md transition-all group">
      {/* Image Strip */}
      {event.image_url ? (
        <div className="h-28 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-[40px] text-purple-300">confirmation_number</span>
        </div>
      )}

      <div className="p-4">
        {/* Title + Status */}
        <div className="flex items-start gap-2 mb-2">
          <h3 className="text-[15px] font-bold text-[#131b2e] flex-1 line-clamp-2">{event.title}</h3>
          <StatusBadge status={event.status} />
        </div>

        {/* Meta */}
        <div className="space-y-1 text-[12px] text-slate-500 mb-3">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
            {formattedDate}
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            <span className="truncate">{event.location}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">label</span>
            {event.category}
          </div>
        </div>

        {/* Ticket inventory bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>{event.total_tickets - event.available_tickets} {t('organizer.ticketsSold').toLowerCase()}</span>
            <span>{event.available_tickets} {t('customer.ticketsLeft')}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#712ae2] to-[#3525cd] transition-all"
              style={{ width: `${soldPercent}%` }}
            />
          </div>
        </div>

        {/* Price */}
        <div className="text-[13px] font-bold text-[#712ae2] mb-4">
          {Number(event.ticket_price) === 0
            ? t('common.free')
            : `ETB ${Number(event.ticket_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Link
            href={`/organizer/events/${event.id}/bookings`}
            id={`attendees-event-${event.id}`}
            className="flex-1 min-w-[70px] px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1 transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[15px]">people</span>
            <span className="truncate">{t('organizer.attendees')}</span>
          </Link>
          <Link
            href={`/organizer/events/${event.id}/edit`}
            id={`edit-event-${event.id}`}
            className="flex-1 min-w-[60px] px-2.5 py-2 rounded-xl text-[12px] font-semibold text-[#712ae2] bg-purple-50 hover:bg-purple-100 flex items-center justify-center gap-1 transition-colors border border-purple-200"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span className="truncate">{t('common.edit')}</span>
          </Link>
          <button
            id={`delete-event-${event.id}`}
            disabled={deleting || event.status !== 'draft'}
            onClick={() => onDelete(event.id)}
            title={event.status !== 'draft' ? 'Only draft events can be deleted' : 'Delete event'}
            className="px-2.5 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-1 transition-colors border border-red-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
          {event.status === 'active' && (
            <Link
              href={`/events/${event.id}`}
              target="_blank"
              title="View public page"
              className="px-2.5 py-2 rounded-xl text-[12px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1 transition-colors border border-slate-200"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrganizerEventsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [events, setEvents]   = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizerEvents();
      setEvents(data.events);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401 || ae.status === 403) {
        router.push('/login');
        return;
      }
      setError(ae.message ?? 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login');
      return;
    }
    if (!['organizer', 'super-admin'].includes(authUser.role ?? '')) {
      router.push('/');
      return;
    }
    setUser(authUser);
    loadEvents();
  }, [router, loadEvents]);

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this draft event? This cannot be undone.')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteOrganizerEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      const ae = err as ApiError;
      setDeleteError(ae.message ?? 'Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#712ae2] text-[28px]">campaign</span>
            <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
            <span className="ml-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Organizer Studio</span>
          </div>
        </header>
        <main className="max-w-6xl mx-auto w-full p-6 sm:p-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-28 bg-slate-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-8 bg-slate-100 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/organizer/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-[#712ae2] text-[28px]">campaign</span>
            <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          </Link>
          <span className="hidden min-[420px]:inline-block ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
            Organizer Studio
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher variant="pill" />
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-bold text-[#131b2e]">{user?.name}</div>
            <div className="text-[11px] text-slate-500">{user?.email}</div>
          </div>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-10 flex-grow">
        {/* Breadcrumb + Title */}
        <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-6">
          <Link href="/organizer/dashboard" className="hover:text-[#712ae2] transition-colors">{t('nav.dashboard')}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#712ae2] font-semibold">{t('organizer.myEvents')}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#131b2e]">{t('organizer.myEvents')}</h1>
            <p className="text-[14px] text-slate-500 mt-1">
              {events.length} event{events.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Link
            href="/organizer/events/create"
            id="create-event-btn"
            className="w-fit px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#712ae2] to-[#3525cd] text-white font-bold text-[14px] flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>{t('nav.createEvent')}</span>
          </Link>
        </div>

        {/* Error */}
        {(error || deleteError) && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error || deleteError}
          </div>
        )}

        {/* Content */}
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={handleDelete}
                deleting={deletingId === event.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
