'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getStoredAuth, logoutUser, validateTicketToken, checkinTicket } from '@/lib/api';
import type { AuthUser } from '@/types/auth';
import type { ValidatedTicket } from '@/types/booking';
import { Html5Qrcode } from 'html5-qrcode';

export default function OrganizerCheckInPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Scanner & Input State
  const [manualToken, setManualToken] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-reader-region';

  // Ticket Validation & Check-in State
  const [validating, setValidating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [ticketResult, setTicketResult] = useState<ValidatedTicket | null>(null);
  const [validationValid, setValidationValid] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastScannedToken, setLastScannedToken] = useState<string | null>(null);
  const [checkedInSuccess, setCheckedInSuccess] = useState(false);

  // Statistics for gate staff session
  const [sessionCheckinCount, setSessionCheckinCount] = useState(0);

  // Check Authentication & Role
  useEffect(() => {
    const { user: authUser, token } = getStoredAuth();
    if (!token || !authUser) {
      router.push('/login?redirect=/organizer/check-in');
      return;
    }
    setUser(authUser);
    setLoadingAuth(false);
  }, [router]);

  async function handleLogout() {
    await logoutUser();
    router.push('/login');
  }

  // Handle Token Validation
  const processValidation = useCallback(async (tokenToValidate: string) => {
    const trimmed = tokenToValidate.trim();
    if (!trimmed) return;

    setValidating(true);
    setFeedbackMessage(null);
    setTicketResult(null);
    setValidationValid(null);
    setCheckedInSuccess(false);
    setLastScannedToken(trimmed);

    try {
      const response = await validateTicketToken(trimmed);
      setValidationValid(response.valid);
      setFeedbackMessage(response.message);
      setTicketResult(response.ticket);
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number; data?: { message?: string; ticket?: ValidatedTicket } };
      setValidationValid(false);
      const msg = e.data?.message || e.message || 'Invalid or unrecognized ticket token.';
      setFeedbackMessage(msg);
      if (e.data?.ticket) {
        setTicketResult(e.data.ticket);
      }
    } finally {
      setValidating(false);
    }
  }, []);

  // Handle Check-in Action
  async function handleCheckIn() {
    if (!lastScannedToken || checkingIn) return;

    setCheckingIn(true);
    setFeedbackMessage(null);

    try {
      const response = await checkinTicket(lastScannedToken);
      setCheckedInSuccess(true);
      setValidationValid(true);
      setFeedbackMessage(response.message || 'Check-in successful! Welcome to the event.');
      setTicketResult(response.ticket);
      setSessionCheckinCount((prev) => prev + 1);
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { message?: string } };
      const msg = e.data?.message || e.message || 'Check-in failed. Please verify ticket status.';
      setFeedbackMessage(msg);
    } finally {
      setCheckingIn(false);
    }
  }

  // Clear & Reset for Next Attendee
  function handleReset() {
    setManualToken('');
    setTicketResult(null);
    setValidationValid(null);
    setFeedbackMessage(null);
    setLastScannedToken(null);
    setCheckedInSuccess(false);
  }

  // Camera Scanner Lifecycle
  const startScanner = useCallback(async () => {
    setScannerError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerDivId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Successfully scanned a QR code!
          // Extract token if decoded text is a full URL or direct token
          let extractedToken = decodedText.trim();
          if (extractedToken.includes('data=')) {
            const match = extractedToken.match(/data=([a-fA-F0-9]+)/);
            if (match && match[1]) {
              extractedToken = match[1];
            }
          }
          processValidation(extractedToken);
        },
        () => {
          // Scanner frame error (normal during continuous scanning)
        }
      );

      setScannerActive(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setScannerError(e.message || 'Camera permission denied or camera not available on this device.');
      setScannerActive(false);
    }
  }, [processValidation]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
    }
    setScannerActive(false);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center font-sans">
        <div className="text-slate-700 font-semibold text-base animate-pulse flex items-center gap-2">
          <span className="material-symbols-outlined text-2xl animate-spin text-[#3525cd]">progress_activity</span>
          Authenticating Gate Portal...
        </div>
      </div>
    );
  }

  // Role Access Guard: Only Organizer or Super Admin
  const isAuthorized = user?.role === 'organizer' || user?.role === 'super-admin';
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[28px]">confirmation_number</span>
            <span className="text-[20px] font-extrabold text-[#131b2e]">TiketHub</span>
          </Link>
          <button onClick={handleLogout} className="text-xs font-semibold text-slate-600 hover:text-slate-900">
            Sign In with Different Account
          </button>
        </header>

        <main className="max-w-lg mx-auto w-full p-6 my-auto">
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">block</span>
            </div>
            <h1 className="text-[22px] font-extrabold text-[#131b2e]">Access Denied</h1>
            <p className="text-sm text-slate-600 mt-2 mb-6">
              Only authenticated <strong>Event Organizers</strong> and <strong>Staff</strong> can access the gate check-in portal.
              You are currently signed in as a customer (<code>{user?.email}</code>).
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/my-bookings"
                className="w-full py-3 rounded-xl bg-[#3525cd] hover:bg-[#4f46e5] text-white font-bold text-sm text-center transition-all shadow-xs"
              >
                Go to My Bookings
              </Link>
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
              >
                Switch Account / Sign Out
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-950 border-b border-slate-800 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#6ffbbe] text-[26px]">confirmation_number</span>
            <span className="text-[19px] font-extrabold text-white">TiketHub</span>
          </Link>
          <span className="text-slate-600 font-light hidden min-[400px]:inline">|</span>
          <div className="hidden min-[400px]:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/10 border border-[#6ffbbe]/30 text-[#6ffbbe] text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6ffbbe] animate-pulse" />
            {t('organizer.gateCheckIn')}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher variant="pill" />
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-slate-400">
            <span>Staff: <strong className="text-white">{user?.name}</strong></span>
            <span>({user?.role})</span>
          </div>
          <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] sm:text-[12px] font-mono text-[#6ffbbe]">
            Admitted: <strong>{sessionCheckinCount}</strong>
          </div>
          <button
            onClick={handleLogout}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-800"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span className="hidden sm:inline">{t('nav.logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Check-In Work Area */}
      <main className="max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Scanner & Input (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Camera QR Scanner Box */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3525cd] text-xl">qr_code_scanner</span>
                  <h2 className="text-[16px] font-extrabold text-[#131b2e]">{t('organizer.scanTicket')}</h2>
                </div>
                {scannerActive ? (
                  <button
                    onClick={stopScanner}
                    className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
                  >
                    Stop Camera
                  </button>
                ) : (
                  <button
                    onClick={startScanner}
                    className="px-3 py-1 rounded-lg bg-[#3525cd] text-white text-xs font-bold hover:bg-[#4f46e5] transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">videocam</span>
                    Start Camera
                  </button>
                )}
              </div>

              {/* Viewfinder Frame */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-square flex items-center justify-center">
                <div id={scannerDivId} className="w-full h-full" />
                {!scannerActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900 text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">center_focus_weak</span>
                    <p className="text-xs">Camera is idle.</p>
                    <button
                      onClick={startScanner}
                      className="mt-3 px-4 py-2 rounded-xl bg-[#3525cd] text-white text-xs font-bold hover:bg-[#4f46e5] transition-colors shadow-xs"
                    >
                      Turn On Camera
                    </button>
                  </div>
                )}
              </div>

              {scannerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[12px] flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-sm mt-0.5 shrink-0">error</span>
                  <span>{scannerError}</span>
                </div>
              )}
            </div>

            {/* Manual Token / Identifier Input Fallback */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-600 text-lg">keyboard</span>
                <h3 className="text-[14px] font-extrabold text-[#131b2e]">{t('organizer.manualTicketId')}</h3>
              </div>
              <p className="text-[12px] text-slate-500">
                If the attendee cannot scan, enter their 64-character token or scan barcode.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  processValidation(manualToken);
                }}
                className="flex flex-col gap-2"
              >
                <input
                  type="text"
                  placeholder="Paste 64-character ticket token..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  disabled={validating}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs font-mono text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#3525cd] bg-slate-50 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={validating || !manualToken.trim()}
                  className="w-full h-10 rounded-xl bg-[#131b2e] hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {validating ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">search</span>
                      <span>{t('organizer.validateTicket')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Validation Result & Check-in Control (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Header Status Card */}
            {validationValid === null && !validating && (
              <div className="bg-white rounded-3xl p-10 border border-slate-200/80 shadow-xs text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-[#e2dfff] text-[#3525cd] flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
                </div>
                <h3 className="text-[18px] font-extrabold text-[#131b2e]">Ready for Scanning</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Point the camera at the attendee&apos;s digital ticket QR code or manually submit a ticket token.
                </p>
              </div>
            )}

            {/* In-Flight Validation Spinner */}
            {validating && (
              <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-xs text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-[#3525cd] animate-spin mb-3">progress_activity</span>
                <h3 className="text-[16px] font-bold text-[#131b2e]">Verifying Ticket with Server...</h3>
                <p className="text-xs text-slate-400 mt-1">Checking ticket authenticity and admission status</p>
              </div>
            )}

            {/* Validation Outcome Card */}
            {validationValid !== null && (
              <div
                className={`bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col ${
                  checkedInSuccess
                    ? 'border-emerald-300 ring-2 ring-emerald-500/20'
                    : validationValid
                    ? 'border-emerald-200'
                    : 'border-rose-300'
                }`}
              >
                {/* Result Header Banner */}
                <div
                  className={`p-5 text-white flex items-center justify-between ${
                    checkedInSuccess
                      ? 'bg-emerald-600'
                      : validationValid
                      ? 'bg-emerald-600'
                      : 'bg-rose-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[28px]">
                      {checkedInSuccess || validationValid ? 'check_circle' : 'cancel'}
                    </span>
                    <div>
                      <h3 className="text-[18px] font-extrabold tracking-tight">
                        {checkedInSuccess
                          ? 'ADMITTED (CHECKED IN)'
                          : validationValid
                          ? 'VALID TICKET — READY FOR ENTRY'
                          : 'ENTRY DENIED (INVALID TICKET)'}
                      </h3>
                      <p className="text-white/90 text-xs mt-0.5">
                        {feedbackMessage || (validationValid ? 'Ticket is authenticated.' : 'Ticket could not be verified.')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors shrink-0"
                  >
                    Reset
                  </button>
                </div>

                {/* Ticket Details Body */}
                {ticketResult && (
                  <div className="p-6 flex flex-col gap-4">
                    {/* Event & Ticket Info */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Event</span>
                        <h4 className="text-[17px] font-extrabold text-[#131b2e]">
                          {ticketResult.event?.title ?? 'Event'}
                        </h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                          {ticketResult.event?.location && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">location_on</span>
                              {ticketResult.event.location}
                            </span>
                          )}
                          {ticketResult.event?.event_date && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">calendar_today</span>
                              {new Date(ticketResult.event.event_date).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Identifier</span>
                        <span className="font-mono text-sm font-bold text-[#3525cd]">
                          {ticketResult.ticket_identifier}
                        </span>
                      </div>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Seat / Number</span>
                        <span className="font-bold text-slate-800">Seat #{ticketResult.seat_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Ticket Status</span>
                        <span
                          className={`font-bold uppercase ${
                            ticketResult.status === 'active'
                              ? 'text-emerald-700'
                              : ticketResult.status === 'used'
                              ? 'text-slate-600'
                              : 'text-rose-700'
                          }`}
                        >
                          {ticketResult.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Payment Status</span>
                        <span className="font-bold uppercase text-slate-800">
                          {ticketResult.booking?.payment_status ?? 'CONFIRMED'}
                        </span>
                      </div>
                    </div>

                    {/* Pay at Door Warning if Cash */}
                    {ticketResult.booking?.payment_status === 'pending' && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600 text-base">payments</span>
                        <span>
                          <strong>Pay at Door:</strong> Collect cash payment before admitting attendee!
                        </span>
                      </div>
                    )}

                    {/* Check-in timestamp if already used */}
                    {ticketResult.checked_in_at && (
                      <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500 text-base">history</span>
                        <span>
                          Checked in: <strong>{new Date(ticketResult.checked_in_at).toLocaleString()}</strong>
                        </span>
                      </div>
                    )}

                    {/* Primary Check-In Action Button */}
                    {ticketResult.status === 'active' && !checkedInSuccess && (
                      <button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[16px] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {checkingIn ? (
                          <>
                            <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                            <span>Processing Admission...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-2xl">how_to_reg</span>
                            <span>{t('organizer.confirmAdmission')}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* If Already Checked in or Processed: Next Attendee button */}
                    {(checkedInSuccess || ticketResult.status === 'used' || !validationValid) && (
                      <button
                        onClick={handleReset}
                        className="w-full h-12 rounded-2xl bg-[#3525cd] hover:bg-[#4f46e5] text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        <span>Scan Next Attendee</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
