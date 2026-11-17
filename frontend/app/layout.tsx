import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { I18nProvider, type Locale } from '@/lib/i18n';
import ThemeSync from '@/components/ThemeSync';

export const metadata: Metadata = {
  title: 'TiketHub - Discover & Book Unforgettable Events | ዝግጅቶችን ያስሱ እና ይያዙ',
  description:
    'Browse real concerts, festivals, and conferences with instant mobile ticketing powered by TiketHub.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  const initialLocale: Locale = localeCookie === 'am' || localeCookie === 'en' ? localeCookie : 'en';

  const themeCookie = cookieStore.get('theme')?.value;
  const initialTheme = themeCookie === 'dark' ? 'dark' : 'light';

  return (
    <html lang={initialLocale} className={initialTheme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ThemeSync />
        <I18nProvider initialLocale={initialLocale}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
