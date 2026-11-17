'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import enMessages from '@/messages/en.json';
import amMessages from '@/messages/am.json';

export type Locale = 'en' | 'am';

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isAmharic: boolean;
}

const STORAGE_KEY = 'tikethub_locale';
const COOKIE_NAME = 'NEXT_LOCALE';

const dictionaries: Record<Locale, Record<string, unknown>> = {
  en: enMessages as Record<string, unknown>,
  am: amMessages as Record<string, unknown>,
};

const I18nContext = createContext<I18nContextType | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale = 'en' }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Sync with client-side localStorage preference after mount if different
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && (stored === 'en' || stored === 'am')) {
        if (stored !== initialLocale) {
          queueMicrotask(() => {
            setLocaleState(stored);
            document.cookie = `${COOKIE_NAME}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
            document.documentElement.lang = stored;
          });
        }
      } else {
        localStorage.setItem(STORAGE_KEY, initialLocale);
        document.cookie = `${COOKIE_NAME}=${initialLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore SSR or storage exceptions
    }
  }, [initialLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const activeDict = dictionaries[locale] || dictionaries.en;
      const fallbackDict = dictionaries.en;

      // Split dot-notation key (e.g., "common.loading" or "admin.totalUsers")
      const keys = key.split('.');

      let value: unknown = activeDict;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }

      // Fallback to English if not found in active dictionary
      if (value === undefined || value === null) {
        let fallbackValue: unknown = fallbackDict;
        for (const k of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && k in fallbackValue) {
            fallbackValue = (fallbackValue as Record<string, unknown>)[k];
          } else {
            fallbackValue = undefined;
            break;
          }
        }
        value = fallbackValue !== undefined ? fallbackValue : key;
      }

      if (typeof value !== 'string') {
        return key;
      }

      // Variable interpolation: replaces {param}
      if (params) {
        let result = value;
        for (const [paramKey, paramVal] of Object.entries(params)) {
          result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }
        return result;
      }

      return value;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isAmharic: locale === 'am',
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback safe dummy context if used outside provider
    return {
      locale: 'en' as Locale,
      setLocale: () => {},
      t: (key: string) => key,
      isAmharic: false,
    };
  }
  return context;
}
