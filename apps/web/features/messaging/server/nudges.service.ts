import 'server-only';

/**
 * Retomar lo que quedó a medias por WhatsApp (22/11), un solo mensaje por cosa y siempre dentro
 * de las 24 h (sin plantilla):
 *
 * - un formulario sin terminar, a la hora y media de su último mensaje: «¿Seguimos? Te faltan
 *   2 datos» con «Continuar» y «Cancelar»;
 * - la cuenta creada por el chat sin confirmar el correo, a las 2 horas: «¿Pudiste confirmar tu
 *   correo?» con «Reenviar correo».
 *
 * Lo corre `/api/jobs/waiting-chats` cada minuto, junto con los recordatorios de la fila.
 */

import { prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { SERVICE_WINDOW_MS, sendButtons } from '@/lib/whatsapp/cloud-api';
import { RESEND_ACCOUNT } from '../bot';
import { CONTINUE, remaining, STOP, type IntakeData, type IntakeKind } from '../intake';

export const INTAKE_NUDGE_AFTER_MS = 90 * 60_000;
export const EMAIL_NUDGE_AFTER_MS = 2 * 60 * 60_000;
// Margen para que el mensaje salga antes de que se cierre la ventana de 24 h.
const WINDOW_MARGIN_MS = 60 * 60_000;

const GOAL: Record<IntakeKind, string> = {
  ENROLL: 'tu inscripción',
  ACCOUNT: 'crear tu cuenta',
  CERTIFICATE: 'pedir tu certificado',
};

export interface NudgeReport {
  intake: number;
  email: number;
  failed: number;
}

/** El texto del recordatorio de un formulario a medias. */
export function intakeNudgeText(kind: IntakeKind, step: number, data: IntakeData): string {
  const name = data.fullName?.trim().split(/\s+/)[0];
  const left = remaining(kind, Math.max(step, 1), data);
  const what =
    left === 0
      ? 'solo te falta confirmar tus datos'
      : `te ${left === 1 ? 'falta 1 dato' : `faltan ${left} datos`}`;
  return `¿Seguimos${name ? `, ${name}` : ''}? 🙌 Para ${GOAL[kind]} ${what}.`;
}

export async function runChatNudges(now: Date = new Date()): Promise<NudgeReport> {
  const report: NudgeReport = { intake: 0, email: 0, failed: 0 };
  const windowOpen = { gte: new Date(now.getTime() - SERVICE_WINDOW_MS + WINDOW_MARGIN_MS) };

  const halfway = await prisma.conversation.findMany({
    where: {
      status: 'BOT',
      intakeKind: { not: null },
      intakeStep: { not: null },
      lastInboundAt: { ...windowOpen, lte: new Date(now.getTime() - INTAKE_NUDGE_AFTER_MS) },
    },
    select: {
      id: true,
      institutionId: true,
      contact: true,
      intakeKind: true,
      intakeStep: true,
      intake: true,
      institution: { select: { whatsappPhoneNumberId: true } },
    },
    take: 200,
  });
  for (const row of halfway) {
    const data = (row.intake ?? {}) as IntakeData;
    if (data._nudgedAt || !row.intakeKind || row.intakeStep === null) continue;
    const text = intakeNudgeText(row.intakeKind, row.intakeStep, data);
    const ok = await nudge(
      row,
      { ...data, _nudgedAt: now.toISOString() },
      text,
      [
        { id: CONTINUE, title: 'Continuar' },
        { id: STOP, title: 'Cancelar' },
      ],
      now
    );
    if (ok) report.intake += 1;
    else report.failed += 1;
  }

  const unconfirmed = await prisma.conversation.findMany({
    where: {
      intakeKind: 'ACCOUNT',
      intakeStep: null,
      lastInboundAt: windowOpen,
      person: { authUserId: null },
    },
    select: {
      id: true,
      institutionId: true,
      contact: true,
      intake: true,
      institution: { select: { whatsappPhoneNumberId: true } },
    },
    take: 200,
  });
  for (const row of unconfirmed) {
    const data = (row.intake ?? {}) as IntakeData;
    const createdAt = data._accountAt ? new Date(data._accountAt).getTime() : NaN;
    if (data._emailNudgedAt || !(now.getTime() - createdAt >= EMAIL_NUDGE_AFTER_MS)) continue;
    const ok = await nudge(
      row,
      { ...data, _emailNudgedAt: now.toISOString() },
      '¿Pudiste confirmar tu correo? 📧 Si no te llegó, revisa la carpeta de spam o te lo reenvío.',
      [
        { id: RESEND_ACCOUNT, title: 'Reenviar correo' },
        { id: 'asesor', title: 'Hablar con asesor' },
      ],
      now
    );
    if (ok) report.email += 1;
    else report.failed += 1;
  }
  return report;
}

/** Marca el recordatorio en el formulario (uno solo) y lo envía y lo deja en el hilo. */
async function nudge(
  row: {
    id: string;
    institutionId: string;
    contact: string;
    institution: { whatsappPhoneNumberId: string | null };
  },
  intake: IntakeData,
  text: string,
  buttons: Array<{ id: string; title: string }>,
  now: Date
): Promise<boolean> {
  await prisma.conversation.update({
    where: { id: row.id },
    data: { intake, lastMessageAt: now },
  });
  const result = await sendButtons(
    row.contact,
    text,
    buttons,
    row.institution.whatsappPhoneNumberId
  );
  if (!result.sent) {
    logger.warn({ event: 'whatsapp-nudge-failed', conversationId: row.id, reason: result.reason });
  }
  await prisma.conversationMessage.create({
    data: {
      institutionId: row.institutionId,
      conversationId: row.id,
      direction: 'OUTBOUND',
      body: `${text} [${buttons.map((b) => b.title).join(' · ')}]`,
      fromBot: true,
      externalId: result.sent ? result.id : null,
      createdAt: now,
    },
  });
  return result.sent;
}
