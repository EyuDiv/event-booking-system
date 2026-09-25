import React from 'react';
import Link from 'next/link';
import type { EventItem } from '@/types/event';
import { useTranslation } from '@/lib/i18n';

function isSoldOut(event: EventItem): boolean {
  return event.status === 'sold_out' || event.available_tickets <= 0;
}

function formatEventDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPrice(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) {
    return String(value);
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ETB`;
}

function hasValidImage(url: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function getCategoryIcon(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('music')) return 'music_note';
  if (normalized.includes('tech')) return 'devices';
  if (normalized.includes('cultur') || normalized.includes('theater')) return 'theater_comedy';
  if (normalized.includes('food') || normalized.includes('drink')) return 'restaurant';
  if (normalized.includes('network') || normalized.includes('group')) return 'groups';
  return 'confirmation_number';
}

export default function EventCard({ event }: { event: EventItem }) {
  const { t } = useTranslation();
  const soldOut = isSoldOut(event);
  const detailsHref = `/events/${event.id}`;
  const categoryIcon = getCategoryIcon(event.category || '');

  return (
    <article
      data-event-id={event.id}
      className="event-card bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:border-[#3525cd]/40 hover:-translate-y-1 group"
    >
      <Link href={detailsHref} className="block">
        {/* Event Image Container */}
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {hasValidImage(event.image_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.image_url as string}
              alt={event.title}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out ${
                soldOut ? 'grayscale-[40%]' : ''
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#3525cd] via-[#4f46e5] to-[#712ae2] text-white">
              <span className="material-symbols-outlined text-[48px] opacity-80">confirmation_number</span>
              <span className="text-[13px] font-semibold mt-1 opacity-90">{event.category}</span>
            </div>
          )}

          {/* Status Badge */}
          {soldOut ? (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-white shadow-sm text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>{t('status.soldOut')}</span>
            </div>
          ) : event.available_tickets <= 20 ? (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 backdrop-blur-md text-white shadow-sm text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{event.available_tickets} {t('customer.ticketsLeft')}</span>
            </div>
          ) : (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/90 backdrop-blur-md text-white shadow-sm text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{t('customer.available')}</span>
            </div>
          )}

          {/* Category Chip */}
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[12px] font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">{categoryIcon}</span>
            <span>{event.category}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#3525cd] mb-2">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            <span>{formatEventDate(event.event_date)}</span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-[18px] text-[#131b2e] leading-snug line-clamp-2 group-hover:text-[#3525cd] transition-colors mb-2.5">
            {event.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500 line-clamp-1 mb-4">
            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">location_on</span>
            <span className="truncate">{event.location}</span>
          </div>

          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 text-[12px] text-slate-500">
              <span className="w-6 h-6 rounded-full bg-[#f2f3ff] text-[#3525cd] flex items-center justify-center font-bold text-[11px] border border-[#3525cd]/15">
                {event.organizer.name?.[0]?.toUpperCase() || 'O'}
              </span>
              <span className="truncate font-medium">{event.organizer.name}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Card Footer */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 mt-auto">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('common.price')}</div>
          <div className="text-[17px] font-extrabold text-[#131b2e] truncate">
            {Number(event.ticket_price) === 0 ? t('common.free') : formatPrice(event.ticket_price)}
          </div>
        </div>

        <Link
          href={detailsHref}
          className="inline-flex items-center justify-center shrink-0 text-[13px] font-bold px-4 py-2 rounded-xl bg-[#3525cd] text-white hover:bg-[#3525cd]/90 shadow-sm transition-all duration-150 active:scale-95 gap-1"
        >
          <span>{t('customer.viewDetails')}</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}
