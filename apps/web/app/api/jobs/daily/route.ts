/**
 * POST /api/jobs/daily — Vercel Cron. Autenticado por `CRON_SECRET` (cabecera
 * `Authorization: Bearer …`, que es como Vercel la manda), no por sesión.
 * SSOT: endpoints.md:103, plan/09 §7.
 *
 * Programado en `apps/web/vercel.json`: 10:00 UTC, 05:00 en Bogotá.
 */

import { NextResponse } from 'next/server';
import { runDailyJob } from '@/features/jobs/server/daily.service';
import { cronAuthorized } from '@/lib/http/cron';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const started = Date.now();
  const reports = await runDailyJob();
  logger.info({ event: 'job-daily', ms: Date.now() - started, reports });
  return NextResponse.json({ data: reports });
}

// Vercel Cron llama con GET; se acepta igual con el mismo secreto.
export const GET = POST;

// Hasta 5 minutos: el job recorre todas las instituciones y cohortes.
export const maxDuration = 300;
