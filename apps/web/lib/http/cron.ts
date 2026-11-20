/**
 * Los jobs de Vercel Cron se autentican con `CRON_SECRET` en `Authorization: Bearer …`, que es
 * como Vercel la manda; no con sesión.
 */

import { timingSafeEqual } from 'node:crypto';

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
