'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredAuth, createOrganizerEvent } from '@/lib/api';
import type { AuthUser } from '@/types/auth';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import type { ApiError } from '@/types/auth';
import type { OrganizerEventPayload } from '@/lib/api';

// ─── Event Categories (must match existing data) ──────────────────────────────
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

// ─── Create Page ──────────────────────────────────────────────────────────────

export default function CreateEventPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [form, setForm] = useState<{
    title: string;
    category: string;
    description: string;
    location: string;
    event_date: string;
    ticket_price: string;
    total_tickets: string;
    status: 'active' | 'draft';
    image: File | null;
  }>({
    title: '',
    category: '',
    description: '',
    location: '',
    event_date: '',
    ticket_price: '0',
    total_tickets: '100',
    status: 'draft',
    image: null as File | null,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login?redirect=/organizer/events/create');
      return;
    }
    const role = (authUser.role as string) ?? '';
    if (!['organizer', 'super-admin', 'admin'].includes(role)) {
      setUser(authUser);
      setAccessDenied(true);
      setLoadingAuth(false);
      return;
    }
    setUser(authUser);
    setLoadingAuth(false);
  }, [router]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});
    setSubmitting(true);

    // Basic client-side required check
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
      setGlobalError('Please fill in all required fields marked with * correctly.');
      setSubmitting(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const payload: OrganizerEventPayload = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      location: form.location.trim(),
      event_date: form.event_date,
      ticket_price: Number(form.ticket_price),
      total_tickets: Number(form.total_tickets),
      status: form.status,
      image: form.image,
    };

    try {
      const res = await createOrganizerEvent(payload);
      // Redirect to edit page for the newly created event with success confirmation
      router.push(`/organizer/events/${res.event.id}/edit?created=1`);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.status === 401) {
        setGlobalError('Your session has expired. Redirecting to login…');
        setTimeout(() => router.push('/login'), 1500);
      } else if (ae.status === 403) {
        setGlobalError(ae.message || 'Access denied: organizer role required.');
      } else if (ae.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(ae.errors)) {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setFieldErrors(mapped);
        setGlobalError(ae.message || 'Validation failed. Please review the highlighted fields below.');
      } else {
        setGlobalError(ae.message ?? 'Unable to create event. Please verify all details and try again.');
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setForm(prev => ({ ...prev, image: file }));
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.image;
        return next;
      });
    } else {
      setImagePreview(null);
    }
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#712ae2]/20 border-t-[#712ae2] rounded-full animate-spin" />
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">Verifying organizer permissions…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#faf8ff] dark:bg-slate-950 flex flex-col font-sans">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between transition-colors duration-200">
          <Link href="/" className="flex items-center gap-2.5 text-[21px] font-extrabold tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#f97316] to-[#ea580c] flex items-center justify-center text-white shadow-xs">
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            </div>
            <span className="text-[#0f172a] dark:text-white">Tiket<span className="text-[#f97316]">Hub</span></span>
          </Link>
          {user && <UserProfileDropdown user={user} />}
        </header>

        {/* Access Restricted Barrier */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-[36px]">shield_lock</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Organizer Access Required
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              You are signed in as <strong className="text-slate-900 dark:text-slate-200">{user?.name}</strong>{' '}
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                {user?.role === 'customer' ? 'Customer / Attendee' : user?.role}
              </span>
              . Only registered Event Organizers and Administrators have permissions to create and publish events.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#f97316] text-white text-sm font-semibold hover:bg-[#ea580c] transition-all shadow-sm shadow-orange-500/20 active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">explore</span>
                Browse Events
              </Link>
              <Link
                href="/my-bookings"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-98"
              >
                <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
                View My Bookings
              </Link>
            </div>
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
          {user && <UserProfileDropdown user={user} />}
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
          <span className="text-[#712ae2] font-semibold">Create Event</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#712ae2] text-[22px]">add_circle</span>
          </div>
          <div>
            <h1 className="text-[24px] font-extrabold text-[#131b2e]">Create New Event</h1>
            <p className="text-[13px] text-slate-500">Fill in the details below to publish or save as draft.</p>
          </div>
        </div>

        {globalError && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Card: Basic Info */}
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
                placeholder="e.g. Addis Jazz Festival 2026"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={255}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" required error={fieldErrors.category}>
                <select
                  id="event-category"
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
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
                  onChange={(e) => set('status', e.target.value as 'active' | 'draft')}
                >
                  <option value="draft">Draft — not publicly visible</option>
                  <option value="active">Active — publicly listed</option>
                </select>
              </Field>
            </div>

            <Field label="Description" error={fieldErrors.description}>
              <textarea
                id="event-description"
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Describe your event…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={5000}
              />
            </Field>
          </div>

          {/* Card: Venue & Date */}
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
                placeholder="e.g. Millennium Hall, Addis Ababa"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                maxLength={255}
              />
            </Field>

            <Field label="Event Date &amp; Time" required error={fieldErrors.event_date} hint="Must be a future date.">
              <input
                id="event-date"
                type="datetime-local"
                className={inputCls}
                value={form.event_date}
                onChange={(e) => set('event_date', e.target.value)}
              />
            </Field>
          </div>

          {/* Card: Tickets */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#131b2e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#712ae2]">confirmation_number</span>
              Tickets &amp; Pricing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ticket Price (ETB)" required error={fieldErrors.ticket_price} hint="Enter 0 for free events.">
                <input
                  id="event-ticket-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={form.ticket_price}
                  onChange={(e) => set('ticket_price', e.target.value)}
                />
              </Field>

              <Field label="Total Tickets" required error={fieldErrors.total_tickets}>
                <input
                  id="event-total-tickets"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  className={inputCls}
                  value={form.total_tickets}
                  onChange={(e) => set('total_tickets', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Card: Media */}
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
                    {form.image ? form.image.name : 'Choose an image...'}
                  </span>
                </label>
              </div>
            </Field>

            {imagePreview && (
              <div className="rounded-xl overflow-hidden border border-slate-200 h-48 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, image: null }));
                    setImagePreview(null);
                    const fileInput = document.getElementById('event-image') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              id="submit-create-event"
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#712ae2] to-[#3525cd] text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Creating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Create Event
                </>
              )}
            </button>
            <Link
              href="/organizer/events"
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-[14px] hover:bg-slate-50 transition-colors text-center flex items-center justify-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
