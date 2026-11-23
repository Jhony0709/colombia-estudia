/**
 * Lo que sale hacia Vercel Analytics (23/11): sin consulta, sin fragmento, sin token de invitación.
 * SSOT: lib/observability/web-analytics.tsx.
 */

jest.mock('@vercel/analytics/next', () => ({ Analytics: () => null }));

import { redactAnalyticsUrl } from '@/lib/observability/web-analytics';

it.each([
  [
    'https://albafuturoeducativo.com/invitacion/8S25X-aAacNrx?x=1',
    'https://albafuturoeducativo.com/invitacion/[token]',
  ],
  [
    'https://albafuturoeducativo.com/auth/callback?code=abc#x',
    'https://albafuturoeducativo.com/auth/callback',
  ],
  ['https://albafuturoeducativo.com/requisitos', 'https://albafuturoeducativo.com/requisitos'],
])('%s → %s', (input, expected) => {
  expect(redactAnalyticsUrl(input)).toBe(expected);
});
