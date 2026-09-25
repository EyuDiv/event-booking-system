'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  loginUser,
  registerUser,
  setStoredAuth,
  getRoleDashboardPath,
  getGoogleAuthUrl,
  exchangeGoogleAuthCode,
} from '@/lib/api';
import type { ApiError, AuthUser } from '@/types/auth';

export default function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation();

  // Active tab: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [successUser, setSuccessUser] = useState<{ name: string; role: string } | null>(null);

  // Register form state (matching Stitch design)
  const [registerRole, setRegisterRole] = useState<'attendee' | 'organizer'>('attendee');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirmation, setRegPasswordConfirmation] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);
  const [regAgreed, setRegAgreed] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regErrors, setRegErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    password_confirmation?: string;
    agreed?: string;
    general?: string;
  }>({});
  const [regSuccess, setRegSuccess] = useState<{ name: string; role: string } | null>(null);

  // Calculate password strength score (0-4)
  function getPasswordStrength(val: string): { score: number; label: string; colorClass: string } {
    if (!val) return { score: 0, label: 'Must be at least 8 characters with letters & numbers', colorClass: 'text-outline' };
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak password - add letters and numbers', colorClass: 'text-error' };
      case 2:
        return { score: 2, label: 'Fair password - include special characters', colorClass: 'text-secondary' };
      case 3:
        return { score: 3, label: 'Good password', colorClass: 'text-primary' };
      case 4:
      default:
        return { score: 4, label: 'Strong & secure password', colorClass: 'text-tertiary' };
    }
  }

  const pwdStrength = getPasswordStrength(regPassword);

  // ── Client-side Validation ──────────────────────────────────────────────────
  function validateLogin(): boolean {
    const errs: typeof errors = {};

    if (!loginEmail.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!loginPassword) {
      errs.password = 'Password is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Handle Login Submission ─────────────────────────────────────────────────
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessUser(null);

    if (!validateLogin()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await loginUser({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      // Securely store token and user in client storage
      setStoredAuth(response);

      setSuccessUser({
        name: response.user.name,
        role: response.user.role,
      });

      // Role-aware redirection
      const destination = getRoleDashboardPath(response.user.role);
      setTimeout(() => {
        router.push(destination);
      }, 700);

    } catch (err) {
      const apiErr = err as ApiError;

      if (apiErr.errors?.email) {
        setErrors({ email: apiErr.errors.email[0] });
      } else if (apiErr.errors?.password) {
        setErrors({ password: apiErr.errors.password[0] });
      } else if (
        apiErr.status === 401 ||
        apiErr.message?.toLowerCase().includes('credential') ||
        apiErr.message?.toLowerCase().includes('incorrect')
      ) {
        setErrors({ general: 'Invalid email or password. Please try again.' });
      } else if (apiErr.message) {
        setErrors({ general: apiErr.message });
      } else {
        setErrors({ general: 'Unable to connect to the server. Please verify the backend is running.' });
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Handle OAuth return parameters (token, error, or code) ─────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('oauth_error');
    const authToken = urlParams.get('auth_token');
    const authUserStr = urlParams.get('auth_user');
    const authCode = urlParams.get('code');
    const authState = urlParams.get('state');

    // 1. Handle OAuth Error query param
    if (oauthError) {
      setErrors({ general: decodeURIComponent(oauthError) });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // 2. Handle direct backend redirect payload (auth_token + auth_user)
    if (authToken && authUserStr) {
      try {
        const parsedUser: AuthUser = JSON.parse(decodeURIComponent(authUserStr));
        setStoredAuth({ token: authToken, user: parsedUser });
        setSuccessUser({ name: parsedUser.name, role: parsedUser.role });
        window.history.replaceState({}, '', window.location.pathname);

        const destination = getRoleDashboardPath(parsedUser.role);
        setTimeout(() => {
          router.push(destination);
        }, 700);
      } catch {
        setErrors({ general: 'Failed to process Google authentication response.' });
      }
      return;
    }

    // 3. Handle frontend authorization code callback (if code and state present)
    if (authCode) {
      setGoogleLoading(true);
      window.history.replaceState({}, '', window.location.pathname);

      exchangeGoogleAuthCode(authCode, authState || undefined)
        .then((response) => {
          setStoredAuth(response);
          setSuccessUser({ name: response.user.name, role: response.user.role });

          const destination = getRoleDashboardPath(response.user.role);
          setTimeout(() => {
            router.push(destination);
          }, 700);
        })
        .catch((err: ApiError) => {
          setErrors({
            general: err.message || 'Google authentication failed. Please try again.',
          });
        })
        .finally(() => {
          setGoogleLoading(false);
        });
    }
  }, [router]);

  // ── Handle Real Google OAuth Login ─────────────────────────────────────────
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setErrors({});
    setSuccessUser(null);

    try {
      const res = await getGoogleAuthUrl();
      if (res.configured && res.url) {
        window.location.href = res.url;
      } else {
        setErrors({
          general:
            res.message ||
            'Google OAuth is not configured yet. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment.',
        });
        setGoogleLoading(false);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({
        general:
          apiErr.message ||
          'Unable to initiate Google Sign-In. Please check your backend connection.',
      });
      setGoogleLoading(false);
    }
  }

  // ── Client-side Validation for Registration ────────────────────────────────
  function validateRegister(): boolean {
    const errs: typeof regErrors = {};

    if (!regFullName.trim()) {
      errs.name = 'Full name is required.';
    }

    if (!regEmail.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!regPassword) {
      errs.password = 'Password is required.';
    } else if (regPassword.length < 8) {
      errs.password = 'Password must be at least 8 characters.';
    }

    if (!regPasswordConfirmation) {
      errs.password_confirmation = 'Please confirm your password.';
    } else if (regPassword !== regPasswordConfirmation) {
      errs.password_confirmation = 'Passwords do not match.';
    }

    if (!regAgreed) {
      errs.agreed = 'You must accept the Terms of Service & Privacy Policy to create an account.';
    }

    setRegErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Handle Registration Submission ─────────────────────────────────────────
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegSuccess(null);

    if (!validateRegister()) return;

    setRegLoading(true);
    setRegErrors({});

    try {
      // Strictly do NOT send role to the public registration API
      const response = await registerUser({
        name: regFullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        password_confirmation: regPasswordConfirmation,
      });

      // Securely store token and user in client storage
      setStoredAuth(response);

      setRegSuccess({
        name: response.user.name,
        role: response.user.role,
      });

      // Role-aware redirection (default customer -> /dashboard)
      const destination = getRoleDashboardPath(response.user.role);
      setTimeout(() => {
        router.push(destination);
      }, 700);
    } catch (err) {
      const apiErr = err as ApiError;
      const fieldErrors: typeof regErrors = {};

      if (apiErr.errors) {
        if (apiErr.errors.name) fieldErrors.name = apiErr.errors.name[0];
        if (apiErr.errors.email) fieldErrors.email = apiErr.errors.email[0];
        if (apiErr.errors.password) fieldErrors.password = apiErr.errors.password[0];
        if (apiErr.errors.password_confirmation) fieldErrors.password_confirmation = apiErr.errors.password_confirmation[0];
      }

      if (Object.keys(fieldErrors).length > 0) {
        setRegErrors(fieldErrors);
      } else if (apiErr.message) {
        setRegErrors({ general: apiErr.message });
      } else {
        setRegErrors({ general: 'Unable to connect to the server. Please verify the backend is running.' });
      }
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <main className="w-full flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-10 min-h-screen">
      <div className="w-full max-w-[1240px] bg-white rounded-2xl overflow-hidden border border-slate-200 tier-3-shadow grid grid-cols-1 lg:grid-cols-12 lg:min-h-[720px]">
        {/* ── Left Showcase Panel (Visual Truth from Stitch) ── */}
        <div className="hidden lg:flex lg:col-span-5 relative flex-col justify-between p-8 lg:p-10 text-white overflow-hidden bg-[#283044]">
          {/* Background Immersive Visual with Indigo-Violet Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30 pointer-events-none"
            style={{
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuA81IZOWEmp5KR8R7grV9TXgnTRHQKHvMVUmqeKEhscXhbb-DweDeGQfI_iyIq1qmZ_wBJYTYkZ9YouZUsHCpbqMUDxVy5WIJ0iieDjQFSohutXyhKmA41sl9tBJmda13OHa-wo0cDwODEKwVAdW7NDns8sQRtubvg8ydgHkPsySSqz6PyeVWN0o8OO947F0ayxf2q7C9fscPAW5TlQL2DuhTQVR9MzSH-mHTnaYuIFAnZ4UE3gKnDykA')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#3525cd]/95 via-[#712ae2]/90 to-[#283044]/95 pointer-events-none" />

          {/* Ambient Glow Circles */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#8a4cfc]/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#4f46e5]/30 rounded-full blur-3xl pointer-events-none" />

          {/* Top Row Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#6ffbbe] text-[32px]">
                confirmation_number
              </span>
              <span className="text-[22px] font-extrabold text-white tracking-tight">
                TiketHub
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/10 text-white mb-6">
              <span className="w-2 h-2 rounded-full bg-[#6ffbbe] animate-pulse" />
              <span className="text-[11px] font-bold tracking-wide">
                Live Ticketing Ecosystem
              </span>
            </div>

            <h2 className="text-[28px] font-bold text-white mb-4 leading-tight tracking-tight">
              Your gateway to unforgettable live experiences.
            </h2>

            <p className="text-[14px] text-[#e2e7ff]/90 max-w-md leading-relaxed">
              Join thousands of event-goers, music lovers, and industry organizers
              exploring premium concerts, festivals, and business summits across East Africa.
            </p>
          </div>

          {/* Value Proposition Badges & Micro-cards */}
          <div className="relative z-10 space-y-3.5 my-8">
            {/* Value Card 1 */}
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all hover:bg-white/15">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 text-[#6ffbbe]">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">
                  Instant telebirr &amp; Chapa Checkout
                </p>
                <p className="text-[13px] text-[#e2e7ff]/70 leading-snug">
                  Seamless local and international card payments in under 60 seconds.
                </p>
              </div>
            </div>

            {/* Value Card 2 */}
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all hover:bg-white/15">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 text-[#eaddff]">
                <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">
                  Anti-Fraud Dynamic QR Passes
                </p>
                <p className="text-[13px] text-[#e2e7ff]/70 leading-snug">
                  Encrypted tickets ready for instant offline gate check-in and transfer.
                </p>
              </div>
            </div>

            {/* Value Card 3 */}
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all hover:bg-white/15">
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 text-[#e2dfff]">
                <span className="material-symbols-outlined text-[22px]">insights</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">
                  Organizer Analytics Studio
                </p>
                <p className="text-[13px] text-[#e2e7ff]/70 leading-snug">
                  Real-time attendance telemetry, payout schedules, and tier adjustments.
                </p>
              </div>
            </div>
          </div>

          {/* Social Proof Footer Banner */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between">
            <div className="flex items-center -space-x-2.5">
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[#e2e7ff] flex items-center justify-center text-[#3525cd] text-[11px] font-bold">
                AK
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[#e2dfff] flex items-center justify-center text-[#3525cd] text-[11px] font-bold">
                MT
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-[#eaddff] flex items-center justify-center text-[#712ae2] text-[11px] font-bold">
                SL
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-white text-[#131b2e] flex items-center justify-center text-[11px] font-bold">
                +50k
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#e2e7ff]">
              Event lovers &amp; organizers
            </span>
          </div>
        </div>

        {/* ── Right Form Area (Interactive Tab Switcher: Sign In & Create Account) ── */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white">
          {/* Header Utility Strip */}
          <div className="flex items-center justify-between pb-4 gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#464555] hover:text-[#3525cd] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {t('common.back')}
            </button>
            <div className="flex items-center gap-3">
              <LanguageSwitcher variant="pill" />
              <a
                href="mailto:support@tikethub.com"
                className="hidden sm:flex text-[11px] font-semibold text-[#464555] hover:text-[#3525cd] items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">contact_support</span>
                Need assistance?
              </a>
            </div>
          </div>

          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-center gap-2 pt-1 pb-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[28px]">
              confirmation_number
            </span>
            <span className="text-[20px] font-extrabold text-[#131b2e] tracking-tight">
              TiketHub
            </span>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="w-full max-w-md mx-auto my-4">
            <div className="p-1 bg-[#f2f3ff] rounded-xl border border-[#c7c4d8]/30 flex items-center shadow-inner">
              <button
                id="tab-login-btn"
                type="button"
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] text-center transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'login'
                    ? 'bg-white text-[#3525cd] shadow-sm font-semibold'
                    : 'text-[#464555] hover:text-[#131b2e] font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                {t('nav.signIn')}
              </button>
              <button
                id="tab-register-btn"
                type="button"
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] text-center transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'register'
                    ? 'bg-white text-[#3525cd] shadow-sm font-semibold'
                    : 'text-[#464555] hover:text-[#131b2e] font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                {t('auth.createAccount')}
              </button>
            </div>
          </div>

          {/* ── CONTENT PANEL: SIGN IN (Default Active) ── */}
          {activeTab === 'login' && (
            <div className="w-full max-w-md mx-auto my-auto transition-opacity duration-200" id="login-panel">
              <div className="mb-6 text-center sm:text-left">
                <h1 className="text-[28px] font-bold text-[#131b2e] tracking-tight">
                  {t('auth.signInTitle')}
                </h1>
                <p className="text-[14px] text-[#464555] mt-1.5 leading-relaxed">
                  {t('auth.signInSubtitle')}
                </p>
              </div>

              {/* Social Quick Sign-in */}
              <div className="space-y-3 mb-6">
                <button
                  id="btn-google-signin"
                  type="button"
                  disabled={loading || regLoading || googleLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full h-11 px-4 rounded-xl border border-[#c7c4d8]/50 bg-white hover:bg-[#f2f3ff] hover:border-[#4f46e5]/40 transition-all text-[13px] font-semibold text-[#131b2e] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                >
                  {googleLoading ? (
                    <div className="flex items-center gap-2 text-[#464555]">
                      <svg className="animate-spin h-4 w-4 text-[#3525cd]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Connecting to Google…</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          fill="#EA4335"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-[#c7c4d8]/30" />
                <span className="flex-shrink mx-4 text-[11px] font-bold text-[#777587] uppercase tracking-wider">
                  or email
                </span>
                <div className="flex-grow border-t border-[#c7c4d8]/30" />
              </div>

              {/* Server Error Alert */}
              {errors.general && (
                <div
                  id="login-error-banner"
                  role="alert"
                  className="mb-4 p-3.5 rounded-xl bg-[#ffdad6]/60 border border-[#ba1a1a]/30 text-[#ba1a1a] text-[13px] flex items-center gap-2.5 animate-fadeIn"
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
                  <span>{errors.general}</span>
                </div>
              )}

              {/* Success Notification */}
              {successUser && (
                <div
                  id="login-success-banner"
                  role="status"
                  className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-[13px] flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0 text-emerald-600">
                    check_circle
                  </span>
                  <span>
                    Welcome back, <strong>{successUser.name}</strong>! Redirecting…
                  </span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                {/* Email Input */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[13px] font-semibold text-[#131b2e] mb-1.5"
                  >
                    {t('auth.emailAddress')}
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      mail
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      required
                      placeholder={t('auth.emailPlaceholder')}
                      value={loginEmail}
                      disabled={loading}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={`w-full h-11 pl-11 pr-4 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        errors.email
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p id="email-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password Input with Show/Hide */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[13px] font-semibold text-[#131b2e]"
                    >
                      {t('auth.password')}
                    </label>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Password reset instructions will be sent to your email.');
                      }}
                      className="text-[11px] font-bold text-[#3525cd] hover:underline"
                    >
                      {t('auth.forgotPassword')}
                    </a>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      lock
                    </span>
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={loginPassword}
                      disabled={loading}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={`w-full h-11 pl-11 pr-11 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        errors.password
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                    <button
                      id="toggle-login-password-btn"
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#777587] hover:text-[#131b2e] transition-colors"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showLoginPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Remember Me & Utility */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#3525cd] focus:ring-[#3525cd]/20 border-[#c7c4d8]/60 cursor-pointer accent-[#4f46e5]"
                    />
                    <span className="text-[13px] font-medium text-[#464555]">
                      {t('auth.rememberMe')}
                    </span>
                  </label>
                </div>

                {/* Submit CTA */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading}
                  className="btn-gradient w-full h-12 rounded-xl text-white text-[15px] flex items-center justify-center gap-2 font-semibold disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>{t('auth.signingIn')}</span>
                    </div>
                  ) : (
                    <>
                      <span>{t('nav.signIn')}</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-[14px] text-[#464555]">
                {t('auth.dontHaveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="text-[#3525cd] text-[13px] font-semibold hover:underline ml-1 cursor-pointer"
                >
                  {t('nav.signUp')}
                </button>
              </p>
            </div>
          )}

          {/* ── CONTENT PANEL: REGISTER / SIGN UP ── */}
          {activeTab === 'register' && (
            <div className="w-full max-w-md mx-auto my-auto transition-opacity duration-200" id="register-panel">
              <div className="mb-5 text-center sm:text-left">
                <h1 className="text-[28px] font-bold text-[#131b2e] tracking-tight">
                  Create Your TiketHub Account
                </h1>
                <p className="text-[14px] text-[#464555] mt-1">
                  Start booking tickets or publish your own landmark events.
                </p>
              </div>

              {/* Server Error Alert */}
              {regErrors.general && (
                <div
                  id="register-error-banner"
                  role="alert"
                  className="mb-4 p-3.5 rounded-xl bg-[#ffdad6]/60 border border-[#ba1a1a]/30 text-[#ba1a1a] text-[13px] flex items-center gap-2.5 animate-fadeIn"
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
                  <span>{regErrors.general}</span>
                </div>
              )}

              {/* Success Notification */}
              {regSuccess && (
                <div
                  id="register-success-banner"
                  role="status"
                  className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-[13px] flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0 text-emerald-600">
                    check_circle
                  </span>
                  <span>
                    Account created successfully, <strong>{regSuccess.name}</strong>! Redirecting…
                  </span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
                {/* Account Role Selection Radio Cards */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-semibold text-[#131b2e]">
                    I want to join as
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Attendee Option */}
                    <button
                      type="button"
                      onClick={() => setRegisterRole('attendee')}
                      className={`relative flex flex-col text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        registerRole === 'attendee'
                          ? 'border-[#3525cd] bg-[#e2dfff]/30'
                          : 'border-[#c7c4d8]/50 bg-white hover:border-[#777587]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`material-symbols-outlined text-[22px] ${
                            registerRole === 'attendee' ? 'text-[#3525cd]' : 'text-[#777587]'
                          }`}
                        >
                          confirmation_number
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            registerRole === 'attendee'
                              ? 'bg-[#3525cd] text-white'
                              : 'border border-[#c7c4d8]/60'
                          }`}
                        >
                          {registerRole === 'attendee' && (
                            <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                          )}
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#131b2e]">Attendee / Customer</span>
                      <span className="text-[11px] text-[#464555] leading-tight mt-0.5">
                        Discover &amp; purchase tickets easily
                      </span>
                    </button>

                    {/* Organizer Option */}
                    <button
                      type="button"
                      onClick={() => setRegisterRole('organizer')}
                      className={`relative flex flex-col text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        registerRole === 'organizer'
                          ? 'border-[#3525cd] bg-[#e2dfff]/30'
                          : 'border-[#c7c4d8]/50 bg-white hover:border-[#777587]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`material-symbols-outlined text-[22px] ${
                            registerRole === 'organizer' ? 'text-[#3525cd]' : 'text-[#777587]'
                          }`}
                        >
                          campaign
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            registerRole === 'organizer'
                              ? 'bg-[#3525cd] text-white'
                              : 'border border-[#c7c4d8]/60'
                          }`}
                        >
                          {registerRole === 'organizer' && (
                            <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                          )}
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#131b2e]">Event Organizer</span>
                      <span className="text-[11px] text-[#464555] leading-tight mt-0.5">
                        Publish events &amp; track sales
                      </span>
                    </button>
                  </div>
                </div>

                {/* Full Name Input */}
                <div>
                  <label htmlFor="reg-fullname" className="block text-[13px] font-semibold text-[#131b2e] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      person
                    </span>
                    <input
                      id="reg-fullname"
                      type="text"
                      placeholder="e.g. Dawit Bekele"
                      value={regFullName}
                      disabled={regLoading}
                      onChange={(e) => {
                        setRegFullName(e.target.value);
                        if (regErrors.name) setRegErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      className={`w-full h-11 pl-11 pr-4 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        regErrors.name
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                  </div>
                  {regErrors.name && (
                    <p id="reg-name-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {regErrors.name}
                    </p>
                  )}
                </div>

                {/* Email Input */}
                <div>
                  <label htmlFor="reg-email" className="block text-[13px] font-semibold text-[#131b2e] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      mail
                    </span>
                    <input
                      id="reg-email"
                      type="email"
                      placeholder="name@example.com"
                      value={regEmail}
                      disabled={regLoading}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        if (regErrors.email) setRegErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={`w-full h-11 pl-11 pr-4 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        regErrors.email
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                  </div>
                  {regErrors.email && (
                    <p id="reg-email-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {regErrors.email}
                    </p>
                  )}
                </div>

                {/* Password and Strength Indicator */}
                <div>
                  <label htmlFor="reg-password" className="block text-[13px] font-semibold text-[#131b2e] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      lock
                    </span>
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="Create a secure password"
                      value={regPassword}
                      disabled={regLoading}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (regErrors.password) setRegErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={`w-full h-11 pl-11 pr-11 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        regErrors.password
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#777587] hover:text-[#131b2e] transition-colors"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showRegPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Mini Password Strength Bars */}
                  <div className="mt-2 grid grid-cols-4 gap-1.5 h-1.5 w-full">
                    <div
                      className={`rounded-full transition-colors ${
                        pwdStrength.score >= 1 ? (pwdStrength.score === 1 ? 'bg-[#ba1a1a]' : 'bg-[#4f46e5]') : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`rounded-full transition-colors ${
                        pwdStrength.score >= 2 ? (pwdStrength.score === 2 ? 'bg-[#712ae2]' : 'bg-[#4f46e5]') : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`rounded-full transition-colors ${
                        pwdStrength.score >= 3 ? 'bg-[#4f46e5]' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`rounded-full transition-colors ${
                        pwdStrength.score >= 4 ? 'bg-[#005338]' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                  <p className={`text-[11px] mt-1 ${pwdStrength.colorClass}`}>{pwdStrength.label}</p>

                  {regErrors.password && (
                    <p id="reg-password-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {regErrors.password}
                    </p>
                  )}
                </div>

                {/* Password Confirmation */}
                <div>
                  <label htmlFor="reg-password-confirmation" className="block text-[13px] font-semibold text-[#131b2e] mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777587] text-[20px] pointer-events-none">
                      lock_reset
                    </span>
                    <input
                      id="reg-password-confirmation"
                      type={showRegPasswordConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={regPasswordConfirmation}
                      disabled={regLoading}
                      onChange={(e) => {
                        setRegPasswordConfirmation(e.target.value);
                        if (regErrors.password_confirmation) {
                          setRegErrors((prev) => ({ ...prev, password_confirmation: undefined }));
                        }
                      }}
                      className={`w-full h-11 pl-11 pr-11 rounded-lg bg-white border text-[#131b2e] placeholder:text-[#777587] text-[14px] transition-all outline-none ${
                        regErrors.password_confirmation
                          ? 'border-[#ba1a1a] focus:ring-4 focus:ring-[#ba1a1a]/15'
                          : 'border-[#c7c4d8]/60 focus:border-[#4f46e5] focus:ring-4 focus:ring-[#3525cd]/10'
                      }`}
                    />
                    <button
                      id="toggle-reg-password-confirm-btn"
                      type="button"
                      onClick={() => setShowRegPasswordConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#777587] hover:text-[#131b2e] transition-colors"
                      aria-label={showRegPasswordConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showRegPasswordConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {regErrors.password_confirmation && (
                    <p id="reg-password-confirm-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {regErrors.password_confirmation}
                    </p>
                  )}
                </div>

                {/* Terms & Privacy Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regAgreed}
                      disabled={regLoading}
                      onChange={(e) => {
                        setRegAgreed(e.target.checked);
                        if (regErrors.agreed) setRegErrors((prev) => ({ ...prev, agreed: undefined }));
                      }}
                      className="w-4 h-4 mt-0.5 rounded text-[#3525cd] focus:ring-[#3525cd]/20 border-[#c7c4d8]/60 cursor-pointer accent-[#4f46e5]"
                    />
                    <span className="text-[13px] text-[#464555] leading-snug">
                      I agree to TiketHub&apos;s{' '}
                      <a href="#" className="text-[#3525cd] hover:underline font-medium">
                        Terms of Service
                      </a>{' '}
                      &amp;{' '}
                      <a href="#" className="text-[#3525cd] hover:underline font-medium">
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  {regErrors.agreed && (
                    <p id="reg-agreed-error-msg" className="text-[12px] text-[#ba1a1a] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {regErrors.agreed}
                    </p>
                  )}
                </div>

                {/* Submit CTA */}
                <button
                  id="btn-register-submit"
                  type="submit"
                  disabled={regLoading}
                  className="btn-gradient w-full h-12 rounded-xl text-white text-[15px] flex items-center justify-center gap-2 font-semibold disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                >
                  {regLoading ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Creating Account…</span>
                    </div>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-[14px] text-[#464555]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-[#3525cd] text-[13px] font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Log In
                </button>
              </p>
            </div>
          )}

          {/* Card Bottom Legal & Trust Microcopy */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#464555] text-[13px]">
            <div className="flex items-center gap-1 text-[#005338]">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>256-bit TLS Encrypted Transaction</span>
            </div>
            <div>© 2025 TiketHub Platform</div>
          </div>
        </div>
      </div>
    </main>
  );
}
