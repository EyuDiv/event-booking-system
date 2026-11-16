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
      className="event-card bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-1 group"
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
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
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
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10b981] backdrop-blur-md text-white shadow-sm text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>{t('customer.available')}</span>
            </div>
          )}

          {/* Price Badge — floating top-left */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
            {Number(event.ticket_price) === 0 ? 'FREE' : `ETB ${Number(event.ticket_price).toLocaleString()}`}
          </div>

          {/* Category Chip — bottom-left */}
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[12px] font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">{categoryIcon}</span>
            <span>{event.category}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          {/* Date & Time — NOV 24 • 6:00 PM style */}
          {(() => {
            const { monthAbbr, day, timeStr } = formatEventDate(event.event_date);
            return (
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-orange-500 uppercase tracking-wide mb-1.5">
                <span>{monthAbbr} {day}</span>
                <span className="opacity-50">•</span>
                <span>{timeStr}</span>
              </div>
            );
          })()}

          {/* Title */}
          <h3 className="font-bold text-[18px] text-[#0f172a] dark:text-white leading-snug line-clamp-2 group-hover:text-orange-500 transition-colors mb-2.5">
            {event.title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500 line-clamp-1 mb-4">
            <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">location_on</span>
            <span className="truncate">{event.location}</span>
          </div>

          {/* Organizer + Get Tickets */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
            {event.organizer ? (
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500 min-w-0">
                <span className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-500 flex items-center justify-center font-bold text-[10px] border border-orange-200/50 dark:border-orange-800/40 shrink-0">
                  {event.organizer.name?.[0]?.toUpperCase() || 'O'}
                </span>
                <span className="truncate font-medium">{event.organizer.name}</span>
              </div>
            ) : <span />}
            <span
              className="text-orange-500 group-hover:text-orange-600 text-[12px] font-bold flex items-center gap-0.5 transition-colors shrink-0 ml-2"
            >
              {t('customer.viewDetails')}
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Card Footer */}
      <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3 mt-auto">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('common.price')}</div>
          <div className="text-[17px] font-extrabold text-[#0f172a] dark:text-white truncate">
            {Number(event.ticket_price) === 0 ? t('common.free') : formatPrice(event.ticket_price)}
          </div>
        </div>

        <Link
          href={detailsHref}
          className="inline-flex items-center justify-center shrink-0 text-[13px] font-bold px-4 py-2 rounded-xl bg-[#0f172a] hover:bg-orange-500 dark:bg-white dark:text-[#0f172a] dark:hover:bg-orange-500 dark:hover:text-white text-white shadow-xs transition-all duration-150 active:scale-95 gap-1"
        >
          <span>{t('customer.viewDetails')}</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </article>
  );
}
