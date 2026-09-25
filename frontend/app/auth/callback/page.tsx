'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { exchangeGoogleAuthCode, setStoredAuth, getRoleDashboardPath } from '@/lib/api';
import type { ApiError, AuthUser } from '@/types/auth';

function AuthCallbackContent() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'error' | 'success'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('oauth_error');
    const authToken = params.get('auth_token') || params.get('token');
    const authUserStr = params.get('auth_user') || params.get('user');
    const code = params.get('code');
    const state = params.get('state');

    if (oauthError) {
      setStatus('error');
      setErrorMessage(decodeURIComponent(oauthError));
      setTimeout(() => {
        router.push(`/login?oauth_error=${encodeURIComponent(oauthError)}`);
      }, 2000);
      return;
    }

    if (authToken && authUserStr) {
      try {
        const user: AuthUser = JSON.parse(decodeURIComponent(authUserStr));
        setStoredAuth({ token: authToken, user });
        setStatus('success');
        setTimeout(() => {
          router.push(getRoleDashboardPath(user.role));
        }, 500);
      } catch {
        setStatus('error');
        setErrorMessage('Failed to decode authentication details.');
        setTimeout(() => router.push('/login'), 2000);
      }
      return;
    }

    if (code) {
      exchangeGoogleAuthCode(code, state || undefined)
        .then((response) => {
          setStoredAuth(response);
          setStatus('success');
          setTimeout(() => {
            router.push(getRoleDashboardPath(response.user.role));
          }, 500);
        })
        .catch((err: ApiError) => {
          setStatus('error');
          const msg = err.message || 'Google authentication failed.';
          setErrorMessage(msg);
          setTimeout(() => {
            router.push(`/login?oauth_error=${encodeURIComponent(msg)}`);
          }, 2000);
        });
      return;
    }

    // Fallback if accessed without params
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f8f9ff]">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-[#3525cd] border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-[#131b2e]">Authenticating with Google…</h2>
            <p className="text-sm text-[#464555]">Verifying your identity and setting up your TiketHub session.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <h2 className="text-xl font-bold text-emerald-800">Authentication Successful!</h2>
            <p className="text-sm text-slate-600">Redirecting to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">error</span>
            </div>
            <h2 className="text-xl font-bold text-[#ba1a1a]">Authentication Failed</h2>
            <p className="text-sm text-slate-600">{errorMessage}</p>
            <p className="text-xs text-slate-400">Returning to login page…</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
          <div className="w-8 h-8 border-4 border-[#3525cd] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
