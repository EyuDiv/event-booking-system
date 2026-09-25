'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  getStoredAuth,
  logoutUser,
  fetchOrganizerEvent,
  updateOrganizerEvent,
  deleteOrganizerEvent,
} from '@/lib/api';
import type { AuthUser } from '@/types/auth';
import type { EventItem } from '@/types/event';
import type { ApiError } from '@/types/auth';

// ─── Event Categories ─────────────────────────────────────────────────────────
const CATEGORIES = [
  'Music', 'Sports', 'Arts', 'Business', 'Technology',
  'Food & Drink', 'Health', 'Education', 'Community', 'Other',
];

// ─── Form Field ───────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, error, children, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#712ae2] focus:ring-2 focus:ring-[#712ae2]/10 transition-all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    // Format: YYYY-MM-DDTHH:mm
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

// ─── Edit Page ────────────────────────────────────────────────────────────────

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params?.id);
  const justCreated = searchParams?.get('created') === '1';

  const [user, setUser]           = useState<AuthUser | null>(null);
  const [event, setEvent]         = useState<EventItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [form, setForm] = useState<{
    title: string;
    category: string;
    description: string;
    location: string;
    event_date: string;
    ticket_price: string;
    total_tickets: string;
    status: string;
    image_url: string;
    image: File | null;
  } | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [submitting, setSubmitting]     = useState(false);
  const [globalError, setGlobalError]   = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(justCreated ? 'Event created successfully!' : null);
  const [deleting, setDeleting]         = useState(false);

  // ── Load event ──
  const loadEvent = useCallback(async () => {
    setLoadingEvent(true);
    setLoadError(null);
    try {
      const data = await fetchOrganizerEvent(id);
      setEvent(data.event);
      setForm({
        title:         data.event.title,
        category:      data.event.category,
        description:   data.event.description ?? '',
        location:      data.event.location,
        event_date:    toDatetimeLocal(data.event.event_date),
        ticket_price:  String(data.event.ticket_price),
        total_tickets: String(data.event.total_tickets),
        status:        data.event.status,
        image_url:     data.event.image_url ?? '',
        image:         null,
      });
      setImagePreview(data.event.image_url ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}${data.event.image_url}` : null);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 403) { router.push('/organizer/events'); return; }
      if (ae.status === 404) { router.push('/organizer/events'); return; }
      setLoadError(ae.message ?? 'Failed to load event.');
    } finally {
      setLoadingEvent(false);
    }
  }, [id, router]);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) { router.push('/login'); return; }
    if (!['organizer', 'super-admin'].includes(authUser.role ?? '')) { router.push('/'); return; }
    setUser(authUser);
    if (id) loadEvent();
  }, [router, id, loadEvent]);

  function setField(field: string, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
    setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    setSuccessMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setGlobalError(null);
    setSuccessMsg(null);
    setFieldErrors({});
    setSubmitting(true);

    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.category) errs.category = 'Category is required.';
    if (!form.location.trim()) errs.location = 'Location is required.';
    if (!form.event_date) errs.event_date = 'Event date is required.';
    if (isNaN(Number(form.ticket_price)) || Number(form.ticket_price) < 0) errs.ticket_price = 'Valid price required (≥ 0).';
    if (!Number.isInteger(Number(form.total_tickets)) || Number(form.total_tickets) < 1) errs.total_tickets = 'Total tickets must be ≥ 1.';

    if (form.image) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(form.image.type)) {
        errs.image = 'Invalid image type. Supported: JPG, PNG, WEBP.';
      } else if (form.image.size > 2 * 1024 * 1024) {
        errs.image = 'Image size must not exceed 2MB.';
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setSubmitting(false);
      return;
    }

    try {
      const res = await updateOrganizerEvent(id, {
        title:         form.title.trim(),
        category:      form.category,
        description:   form.description.trim() || undefined,
        location:      form.location.trim(),
        event_date:    form.event_date,
        ticket_price:  Number(form.ticket_price),
        total_tickets: Number(form.total_tickets),
        status:        form.status as 'active' | 'draft' | 'sold_out',
        image:         form.image, // Could be File or null (if explicitly removed)
      } as Parameters<typeof updateOrganizerEvent>[1]);
      setEvent(res.event);
      setSuccessMsg('Event updated successfully!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const ae = err as ApiError;
      if (ae.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(ae.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setFieldErrors(mapped);
      } else {
        setGlobalError(ae.message ?? 'Failed to update event.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (file) {
      setForm(prev => prev ? { ...prev, image: file } : prev);
      setImagePreview(URL.createObjectURL(file));
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.image;
        return next;
      });
      setSuccessMsg(null);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm('Delete this event? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteOrganizerEvent(event.id);
      router.push('/organizer/events');
    } catch (err) {
      const ae = err as ApiError;
      setGlobalError(ae.message ?? 'Failed to delete event.');
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  // ── Loading skeleton ──
  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#712ae2] text-[28px]">campaign</span>
          <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          <span className="ml-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">Organizer Studio</span>
        </header>
        <main className="max-w-2xl mx-auto w-full p-6 sm:p-10">
          <div className="space-y-5 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="h-4 bg-slate-100 rounded w-1/3" />
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 font-semibold mb-3">{loadError}</div>
          <Link href="/organizer/events" className="text-[#712ae2] text-[13px] underline">← Back to My Events</Link>
        </div>
      </div>
    );
  }

  if (!form) return null;

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
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto w-full p-4 sm:p-10 flex-grow">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-6">
          <Link href="/organizer/dashboard" className="hover:text-[#712ae2] transition-colors">Dashboard</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/organizer/events" className="hover:text-[#712ae2] transition-colors">My Events</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-[#712ae2] font-semibold truncate max-w-[160px]">{event?.title}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#712ae2] text-[22px]">edit</span>
            </div>
            <div>
              <h1 className="text-[22px] font-extrabold text-[#131b2e] leading-tight">Edit Event</h1>
              <p className="text-[12px] text-slate-400 mt-0.5">ID #{id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/organizer/events/${id}/bookings`}
              className="px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">people</span>
              <span className="hidden sm:inline">Attendees</span>
            </Link>
            {event?.status === 'active' && (
              <Link
                href={`/events/${id}`}
                target="_blank"
                className="px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                <span className="hidden sm:inline">Public Page</span>
              </Link>
            )}
            {event?.status === 'draft' && (
              <button
                id="delete-event-btn"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                <span className="hidden sm:inline">{deleting ? 'Deleting…' : 'Delete'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Success */}
        {successMsg && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {successMsg}
          </div>
        )}

        {/* Error */}
        {globalError && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {globalError}
          </div>
        )}

        {/* Inventory Info */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-[12px] text-slate-600 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="font-bold text-[16px] text-[#131b2e]">{event?.total_tickets?.toLocaleString()}</div>
            <div>Total</div>
          </div>
          <div>
            <div className="font-bold text-[16px] text-emerald-700">
              {event?.available_tickets?.toLocaleString()}
            </div>
            <div>Available</div>
          </div>
          <div>
            <div className="font-bold text-[16px] text-[#712ae2]">
              {((event?.total_tickets ?? 0) - (event?.available_tickets ?? 0)).toLocaleString()}
            </div>
            <div>Sold</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Basic Info */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#131b2e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#712ae2]">info</span>
              Basic Information
            </h2>

            <Field label="Event Title" required error={fieldErrors.title}>
              <input
                id="event-title"
                type="text"
                className={inputCls}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                maxLength={255}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" required error={fieldErrors.category}>
                <select
                  id="event-category"
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Status" required error={fieldErrors.status}>
                <select
                  id="event-status"
                  className={inputCls}
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  <option value="draft">Draft — not publicly visible</option>
                  <option value="active">Active — publicly listed</option>
                  <option value="sold_out">Sold Out</option>
                </select>
              </Field>
            </div>

            <Field label="Description" error={fieldErrors.description}>
              <textarea
                id="event-description"
                className={`${inputCls} resize-none`}
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                maxLength={5000}
              />
            </Field>
          </div>

          {/* Venue & Date */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#131b2e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#712ae2]">location_on</span>
              Venue &amp; Date
            </h2>

            <Field label="Location" required error={fieldErrors.location}>
              <input
                id="event-location"
                type="text"
                className={inputCls}
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                maxLength={255}
              />
            </Field>

            <Field label="Event Date &amp; Time" required error={fieldErrors.event_date}>
              <input
                id="event-date"
                type="datetime-local"
                className={inputCls}
                value={form.event_date}
                onChange={(e) => setField('event_date', e.target.value)}
              />
            </Field>
          </div>

          {/* Tickets */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#131b2e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#712ae2]">confirmation_number</span>
              Tickets &amp; Pricing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ticket Price (ETB)" required error={fieldErrors.ticket_price}>
                <input
                  id="event-ticket-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.ticket_price}
                  onChange={(e) => setField('ticket_price', e.target.value)}
                />
              </Field>

              <Field
                label="Total Tickets"
                required
                error={fieldErrors.total_tickets}
                hint="Changing this recalculates availability."
              >
                <input
                  id="event-total-tickets"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  className={inputCls}
                  value={form.total_tickets}
                  onChange={(e) => setField('total_tickets', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Media */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#131b2e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#712ae2]">image</span>
              Event Image
            </h2>

            <Field label="Upload Cover Image" error={fieldErrors.image} hint="Supported formats: JPG, PNG, WEBP. Max size: 2MB.">
              <div className="relative">
                <input
                  id="event-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <label
                  htmlFor="event-image"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-slate-400">upload_file</span>
                  <span className="text-[13px] text-slate-600 font-medium">
                    {form.image && form.image instanceof File ? form.image.name : 'Choose an image to replace...'}
                  </span>
                </label>
              </div>
            </Field>

            {imagePreview && (
              <div className="rounded-xl overflow-hidden border border-slate-200 h-48 relative mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm(prev => prev ? { ...prev, image: null, image_url: '' } : prev);
                    setImagePreview(null);
                    const fileInput = document.getElementById('event-image') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                    setSuccessMsg(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove image"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              id="submit-edit-event"
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#712ae2] to-[#3525cd] text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Save Changes
                </>
              )}
            </button>
            <Link
              href="/organizer/events"
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-[14px] hover:bg-slate-50 transition-colors text-center flex items-center justify-center"
            >
              Back
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
