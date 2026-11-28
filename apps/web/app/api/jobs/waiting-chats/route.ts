/**
 * POST /api/jobs/waiting-chats — Vercel Cron, cada minuto (14/11). Autenticado por `CRON_SECRET`.
 * Recordatorios a quien espera asesor por WhatsApp (`features/messaging/server/waiting.service.ts`)
 * y, desde el 22/11, lo que quedó a medias en el chat (`nudges.service.ts`). Desde el 27/11, los
 * recordatorios a quien atiende (`agent-alerts.service.ts`) y los push pendientes
 * (`push.service.ts`).
 */

import { NextResponse } from 'next/server';
import { runWaitingReminders } from '@/features/messaging/server/waiting.service';
import { runChatNudges } from '@/features/messaging/server/nudges.service';
import { runAgentReminders } from '@/features/messaging/server/agent-alerts.service';
import { runPushSweep } from '@/features/notifications/server/push.service';
import { cronAuthorized } from '@/lib/http/cron';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const report = await runWaitingReminders();
  const nudges = await runChatNudges();
  const agents = await runAgentReminders();
  // Un fallo de Expo no deja sin respuesta al cron: se reintenta en el siguiente minuto.
  const push = await runPushSweep().catch((error: unknown) => {
    logger.error({
      event: 'push-sweep-failed',
      err: error instanceof Error ? error.message : error,
    });
    return { sent: 0, failed: 0, checked: 0 };
  });
  if (
    report.checked > 0 ||
    report.closed > 0 ||
    nudges.intake + nudges.email + nudges.failed > 0 ||
    agents.waiting + agents.unanswered > 0 ||
    push.sent + push.failed + push.checked > 0
  ) {
    logger.info({ event: 'job-waiting-chats', report, nudges, agents, push });
  }
  return NextResponse.json({ data: { ...report, nudges, agents, push } });
}

export const GET = POST;
