import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AnnounceProvider } from '@/lib/a11y/announce';
import { AccessibilityPreferencesProvider } from '@/lib/a11y/preferences-provider';
import { FocusManager } from '@/lib/a11y/focus-manager';
import { SkipLink } from '@/lib/a11y/skip-link';
import './globals.css';

/**
 * Toda la app se renderiza dinamicamente.
 *
 * No es una preferencia: el middleware manda una CSP con `nonce` + `strict-dynamic`
 * (middleware.ts, buildCsp). Con `strict-dynamic` el navegador ignora `'self'` en
 * `script-src`, asi que solo corren los scripts que lleven el nonce de esa peticion.
 * Next inyecta ese nonce leyendo la cabecera CSP *en tiempo de render*
 * (next/dist/server/app-render/app-render.js:109), y una pagina prerenderizada en el
 * build nunca pasa por ahi: su HTML sale sin nonce, el navegador bloquea todos los
 * <script>, React no hidrata y la pagina se queda en el esqueleto de Suspense.
 *
 * Paso exactamente eso con /auth/login en el primer build de produccion (16/9).
 * Si algun dia se quita `strict-dynamic` de la CSP, esto se puede revisar.
 */
export const dynamic = 'force-dynamic';

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
