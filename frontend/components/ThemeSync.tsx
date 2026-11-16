'use client';

import { useEffect } from 'react';

// Immediately runs on the client as soon as this module is evaluated in the browser,
// before React even finishes mounting components, eliminating any flash of light theme.
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  } catch {
    // Ignore restricted localStorage contexts
  }
}

export default function ThemeSync() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (stored === 'dark' || (!stored && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  return null;
}
