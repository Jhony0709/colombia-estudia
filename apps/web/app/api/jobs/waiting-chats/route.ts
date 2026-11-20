/**
 * POST /api/jobs/waiting-chats — Vercel Cron, cada minuto (14/11). Autenticado por `CRON_SECRET`.
 * Recordatorios a quien espera asesor por WhatsApp (`features/messaging/server/waiting.service.ts`).
 */

import { NextResponse } from 'next/server';
import { runWaitingReminders } from '@/features/messaging/server/waiting.service';
import { cronAuthorized } from '@/lib/http/cron';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const report = await runWaitingReminders();
  if (report.checked > 0 || report.closed > 0) logger.info({ event: 'job-waiting-chats', report });
  return NextResponse.json({ data: report });
}

export const GET = POST;
