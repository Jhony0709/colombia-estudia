/**
 * Sentry initialization with PII filtering.
 * SSOT: plan/02-fundaciones.md §7
 *
 * Deuda: Sentry solo Node runtime por ahora.
 */

import * as Sentry from '@sentry/nextjs';

const PII_FIELDS = new Set([
  'email',
  'documentNumber',
  'givenName',
  'familyName',
  'phone',
  'birthDate',
  'password',
  'token',
  'answerKey',
  'authorization',
  'cookie',
]);

function stripPII(obj: Record<string, unknown> | undefined): void {
  if (!obj) return;
  for (const key of Object.keys(obj)) {
    if (PII_FIELDS.has(key)) {
      delete obj[key];
    }
  }
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // No error if missing

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip user data
      delete event.user;

      // Strip request PII
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
      }

      // Strip PII from extra
      if (event.extra) {
        stripPII(event.extra as Record<string, unknown>);
      }

      // Strip PII from contexts
      if (event.contexts) {
        for (const ctx of Object.values(event.contexts)) {
          if (ctx && typeof ctx === 'object') {
            stripPII(ctx as Record<string, unknown>);
          }
        }
      }

      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => {
          if (bc.data) {
            stripPII(bc.data as Record<string, unknown>);
          }
          return bc;
        });
      }

      return event;
    },
  });
}
