import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/alegreya/wght.css';
import '@fontsource-variable/martian-mono/wdth.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { TIME_ZONE_COOKIE } from '@/i18n/config';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: { default: 'Conversa', template: '%s · Conversa' },
    description: t('meta.description'),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Applies a stored theme before the first paint, so a dark choice never flashes light, and
// tells the server the browser's time zone, so dates it renders match what the browser would.
const themeScript = `try{var t=localStorage.getItem('conversa-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}try{document.cookie='${TIME_ZONE_COOKIE}='+encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'')}catch(e){}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // The script may set data-theme before React hydrates; this tells React that is expected.
    <html lang={locale} dir="ltr" data-density="comfortable" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers locale={locale}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
