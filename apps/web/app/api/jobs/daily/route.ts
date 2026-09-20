/**
 * POST /api/jobs/daily — Vercel Cron. Autenticado por `CRON_SECRET` (cabecera
 * `Authorization: Bearer …`, que es como Vercel la manda), no por sesión.
 * SSOT: endpoints.md:103, plan/09 §7.
 *
 * `vercel.json` con el `crons` lo añade Jhonny (protegido: `.github/*`, y el deploy es suyo).
 */

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runDailyJob } from '@/features/jobs/server/daily.service';
import { logger } from '@/lib/observability/logger';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const started = Date.now();
  const reports = await runDailyJob();
  logger.info({ event: 'job-daily', ms: Date.now() - started, reports });
  return NextResponse.json({ data: reports });
}

// Vercel Cron llama con GET; se acepta igual con el mismo secreto.
export const GET = POST;
