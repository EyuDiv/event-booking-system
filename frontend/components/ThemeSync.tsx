'use client';

import { useEffect } from 'react';

export default function ThemeSync() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = stored === 'dark' || (!stored && prefersDark);
      const activeTheme = isDark ? 'dark' : 'light';

      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }

      // Synchronize cookie for future SSR renders
      document.cookie = `theme=${activeTheme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  return null;
}
