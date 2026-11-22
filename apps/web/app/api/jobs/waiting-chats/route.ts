/**
 * POST /api/jobs/waiting-chats — Vercel Cron, cada minuto (14/11). Autenticado por `CRON_SECRET`.
 * Recordatorios a quien espera asesor por WhatsApp (`features/messaging/server/waiting.service.ts`)
 * y, desde el 22/11, lo que quedó a medias en el chat (`nudges.service.ts`).
 */

import { NextResponse } from 'next/server';
import { runWaitingReminders } from '@/features/messaging/server/waiting.service';
import { runChatNudges } from '@/features/messaging/server/nudges.service';
import { cronAuthorized } from '@/lib/http/cron';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const report = await runWaitingReminders();
  const nudges = await runChatNudges();
  if (report.checked > 0 || report.closed > 0 || nudges.intake + nudges.email + nudges.failed > 0) {
    logger.info({ event: 'job-waiting-chats', report, nudges });
  }
  return NextResponse.json({ data: { ...report, nudges } });
}

export const GET = POST;
