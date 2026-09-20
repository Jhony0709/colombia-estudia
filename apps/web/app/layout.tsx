import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { THEME_COOKIE, themeClass, themeColorScheme, toTheme } from '@/lib/theme/theme';
import { AnnounceProvider } from '@/lib/a11y/announce';
import { AccessibilityPreferencesProvider } from '@/lib/a11y/preferences-provider';
import { TooltipProvider } from '@/components/atoms/tooltip';
import { FocusManager } from '@/lib/a11y/focus-manager';
import { SkipLink } from '@/lib/a11y/skip-link';
import { atkinson } from './fonts/sans';
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

/**
 * `<meta name="color-scheme">` con el tema de la cookie.
 *
 * Es lo que hace que los controles que pinta el navegador —el `select` nativo, la barra de
 * desplazamiento, el calendario de un `date`— vayan con el tema desde el primer fotograma, antes
 * de que llegue la hoja de estilos. El plugin de tokens también declara `color-scheme` por
 * clase, pero eso sólo vale cuando el CSS ya está; esto vale con el HTML solo.
 *
 * Va por `generateViewport` y no como `style={{ colorScheme }}` en el `<html>` porque un
 * atributo `style` es estilo en línea, y la CSP del middleware (`style-src 'self' 'nonce-…'`,
 * sin `'unsafe-inline'`) lo bloquearía. Un `<meta>` no es estilo.
 */
export async function generateViewport(): Promise<Viewport> {
  const cookieStore = await cookies();
  return { colorScheme: themeColorScheme(toTheme(cookieStore.get(THEME_COOKIE)?.value)) };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [messages, cookieStore] = await Promise.all([getMessages(), cookies()]);

  /*
    El tema se decide AQUÍ, en el servidor, y por eso no parpadea: el HTML sale con la clase
    puesta. Se puede hacer porque este layout ya es `force-dynamic` (ver arriba) — en una
    página prerenderizada esta cookie no existiría en tiempo de build.
  */
  const theme = toTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    // `atkinson.variable` define --font-sans, que el plugin de design-tokens usa como
    // primera familia de `fontFamily.sans`. Si la fuente no cargara, el token cae
    // al stack del sistema y nada se rompe.
    <html lang="es-CO" className={`${atkinson.variable} ${themeClass(theme)}`.trim()}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AccessibilityPreferencesProvider>
            <TooltipProvider>
              <AnnounceProvider>
                <SkipLink />
                <FocusManager />
                {/*
                El <main id="contenido"> lo pone cada área: (public), (staff) y (admin).
                Si viviera aquí, la cabecera de navegación quedaría dentro del contenido
                principal y el enlace "saltar al contenido" llevaría al menú, no al contenido.
              */}
                {children}
              </AnnounceProvider>
            </TooltipProvider>
          </AccessibilityPreferencesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
