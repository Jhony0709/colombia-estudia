/**
 * Server-side i18n request configuration.
 * Used by next-intl for RSC.
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';

export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`@/messages/${defaultLocale}.json`)).default,
  /**
   * Explícito a propósito, igual que en `packages/domain/src/dates.ts` y en la plantilla del
   * correo de invitación. Sin esto, `useFormatter` usa la zona de quien renderiza: UTC en el
   * servidor de Vercel y la del navegador en el cliente. Una fecha formateada entre las 19:00
   * y la medianoche de Bogotá salía con el día siguiente, y encima distinta en servidor y en
   * cliente —que además es una discrepancia de hidratación—.
   *
   * La plataforma opera en una sola zona. Esta.
   */
  timeZone: 'America/Bogota',
}));
