import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AnnounceProvider } from '@/lib/a11y/announce';
import { AccessibilityPreferencesProvider } from '@/lib/a11y/preferences-provider';
import { FocusManager } from '@/lib/a11y/focus-manager';
import { SkipLink } from '@/lib/a11y/skip-link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Colombia Estudia',
  description: 'Plataforma de educación',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="es-CO">
      <body>
        <NextIntlClientProvider messages={messages}>
          <AccessibilityPreferencesProvider>
            <AnnounceProvider>
              <SkipLink />
              <FocusManager />
              <main id="contenido">{children}</main>
            </AnnounceProvider>
          </AccessibilityPreferencesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
