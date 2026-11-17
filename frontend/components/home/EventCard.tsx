'use client';

import React from 'react';
import Link from 'next/link';
import type { EventItem } from '@/types/event';
import { useTranslation } from '@/lib/i18n';

function isSoldOut(event: EventItem): boolean {
  return event.status === 'sold_out' || event.available_tickets <= 0;
}

function formatEventDate(value: string): { monthAbbr: string; day: string; timeStr: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { monthAbbr: '—', day: '—', timeStr: '—' };
  }
  const monthAbbr = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = String(date.getDate());
  const timeStr = date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { monthAbbr, day, timeStr };
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
  const normalized = (category || '').toLowerCase();
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
  const { monthAbbr, day, timeStr } = formatEventDate(event.event_date);
  const isFree = Number(event.ticket_price) === 0;

  return (
    <article
      data-event-id={event.id}
      className="event-card bg-white dark:bg-slate-900 border border-[#E4E7EC] dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-1 group"
    >
      <Link href={detailsHref} className="block flex-1 focus:outline-none">
        {/* Cover Image Container */}
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
          {hasValidImage(event.image_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.image_url as string}
              alt={event.title}
              loading="lazy"
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out ${
                soldOut ? 'grayscale-[40%]' : ''
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#101828] via-slate-900 to-[#101828] text-white">
              <span className="material-symbols-outlined text-[48px] text-white/70">
                {categoryIcon}
              </span>
              <span className="text-[12px] font-semibold mt-1.5 text-white/80 uppercase tracking-wider">
                {event.category || 'Event'}
              </span>
            </div>
          )}

          {/* Price Tag Chip: Top-Left */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold shadow-xs">
            {isFree ? 'FREE' : `ETB ${Number(event.ticket_price).toLocaleString()}`}
          </div>

          {/* Availability Status Badge: Top-Right */}
          {soldOut ? (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-white shadow-xs text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>{t('status.soldOut')}</span>
            </div>
          ) : event.available_tickets <= 20 ? (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/95 backdrop-blur-md text-white shadow-xs text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{event.available_tickets} {t('customer.ticketsLeft')}</span>
            </div>
          ) : (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/95 backdrop-blur-md text-white shadow-xs text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{t('customer.available')}</span>
            </div>
          )}

          {/* Category Chip: Bottom-Left */}
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs">
            <span className="material-symbols-outlined text-[14px]">{categoryIcon}</span>
            <span>{event.category}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 flex flex-col flex-1">
          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#FF6500] uppercase tracking-wide mb-1.5">
            <span>{monthAbbr} {day}</span>
            <span className="opacity-40">•</span>
            <span>{timeStr}</span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-[18px] text-[#101828] dark:text-white leading-snug line-clamp-2 group-hover:text-[#FF6500] transition-colors mb-2.5">
            {event.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-[13px] text-[#667085] dark:text-slate-400 line-clamp-1 mb-4">
            <span className="material-symbols-outlined text-[17px] text-[#667085]/80 shrink-0">location_on</span>
            <span className="truncate">{event.location}</span>
          </div>

          {/* Organizer Info & Detail Indicator */}
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#E4E7EC]/60 dark:border-slate-800">
            {event.organizer ? (
              <div className="flex items-center gap-2 text-[12px] text-[#667085] dark:text-slate-400 min-w-0">
                <span className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#FF6500] flex items-center justify-center font-bold text-[10px] border border-orange-200/50 dark:border-orange-800/40 shrink-0">
                  {event.organizer.name?.[0]?.toUpperCase() || 'O'}
                </span>
                <span className="truncate font-medium">{event.organizer.name}</span>
              </div>
            ) : <span />}

            <span className="text-[#FF6500] group-hover:text-[#E05A00] text-[12px] font-bold flex items-center gap-0.5 transition-colors shrink-0 ml-2">
              {t('customer.viewDetails')}
              <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </span>
          </div>
        </div>
      </Link>

      {/* Card Footer: Price & Action */}
      <div className="px-5 py-3.5 border-t border-[#E4E7EC] dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400">
            {t('common.price')}
          </div>
          <div className="text-[17px] font-extrabold text-[#101828] dark:text-white truncate">
            {isFree ? t('common.free') : formatPrice(event.ticket_price)}
          </div>
        </div>

        <Link
          href={detailsHref}
          className="inline-flex items-center justify-center shrink-0 text-[13px] font-bold px-4 py-2 rounded-xl bg-[#101828] hover:bg-[#FF6500] text-white shadow-xs transition-all duration-150 active:scale-95 gap-1.5"
        >
          <span>{t('customer.viewDetails')}</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}
