'use client';

/**
 * Vercel Web Analytics (23/11): sin cookies y por el mismo dominio (`/_vercel/insights/*`).
 * Antes de enviar, la URL pierde la consulta y el fragmento, y el token de la invitación.
 */

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

export function redactAnalyticsUrl(url: string): string {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/^\/invitacion\/[^/]+/, '/invitacion/[token]');
  return u.toString();
}

const beforeSend = (event: BeforeSendEvent): BeforeSendEvent => ({
  ...event,
  url: redactAnalyticsUrl(event.url),
});

export function WebAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
