/**
 * El job diario. SSOT: endpoints.md:103, plan/09 §7, plan/08 §3/§5/§6.
 *
 * Una pasada por institución, idempotente: cada aviso lleva `dedupeKey` (cuota + día,
 * sesión + ventana, intento…) y cada emisión choca contra un índice único. Correrlo dos
 * veces el mismo día no manda nada dos veces. Al final, `AuditLog job.daily` con los
 * conteos, que es lo que se mira cuando alguien pregunta «¿corrió anoche?».
 *
 * Qué hace, en orden:
 * 1. cierra intentos vencidos (`expireIfDue`);
 * 2. emite constancias y cierra matrículas completas;
 * 3. acuerdos cumplidos → `FULFILLED`; acuerdos con cuota vencida → aviso a operación;
 * 4. cuotas vencidas → aviso al pagador, solo si `notifyPayerOnOverdue` (y correo, si hay);
 * 5. sesiones en vivo en las próximas 24 h → aviso a los matriculados;
 * 6. concilia pagos de pasarela sin confirmar de más de una hora.
 */

import 'server-only';

import { createTenantClient, prisma } from '@/lib/db/tenant';
import { getMailer, isMailConfigured } from '@/lib/mail';
import { fetchTransaction } from '@/lib/billing/wompi';
import { logger } from '@/lib/observability/logger';
import { expireIfDue } from '@/features/learn/server/attempt.service';
import { issueDueCertificates } from '@/features/certificates/server/certificates.service';
import { settleAgreements, confirmPayment } from '@/features/billing/server/billing.service';
import {
  notify,
  notifyMany,
  staffPersonIds,
} from '@/features/notifications/server/notifications.service';
import { getPolicy } from '@/features/admin/server/policies.service';

export interface DailyJobReport {
  institutionId: string;
  expiredAttempts: number;
  certificatesIssued: number;
  enrollmentsCompleted: number;
  agreementsFulfilled: number;
  agreementOverdueAlerts: number;
  overdueReminders: number;
  liveSessionReminders: number;
  gatewayReconciled: number;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function runDailyJob({ now = new Date() }: { now?: Date } = {}): Promise<
  DailyJobReport[]
> {
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true, emailFromName: true, supportEmail: true },
  });
  const reports: DailyJobReport[] = [];
  for (const inst of institutions) {
    const report = await runForInstitution({ institution: inst, now });
    reports.push(report);
  }
  return reports;
}

async function runForInstitution({
  institution,
  now,
}: {
  institution: { id: string; name: string; emailFromName: string; supportEmail: string };
  now: Date;
}): Promise<DailyJobReport> {
  const institutionId = institution.id;
  const db = createTenantClient(institutionId);
  const report: DailyJobReport = {
    institutionId,
    expiredAttempts: 0,
    certificatesIssued: 0,
    enrollmentsCompleted: 0,
    agreementsFulfilled: 0,
    agreementOverdueAlerts: 0,
    overdueReminders: 0,
    liveSessionReminders: 0,
    gatewayReconciled: 0,
  };

  // 1. Intentos vencidos.
  const openAttempts = await db.attempt.findMany({
    where: { status: 'IN_PROGRESS', deadlineAt: { lte: now } },
    select: { id: true, status: true, deadlineAt: true, answers: true },
  });
  for (const a of openAttempts) {
    try {
      if (await expireIfDue({ institutionId, attempt: a, now })) report.expiredAttempts++;
    } catch (err) {
      logger.warn({ event: 'job-expire-attempt-failed', attemptId: a.id, error: String(err) });
    }
  }

  // 2. Constancias.
  try {
    const r = await issueDueCertificates({ institutionId, now });
    report.certificatesIssued = r.issued;
    report.enrollmentsCompleted = r.completedEnrollments;
  } catch (err) {
    logger.warn({ event: 'job-certificates-failed', institutionId, error: String(err) });
  }

  // 3. Acuerdos.
  report.agreementsFulfilled = await settleAgreements({ institutionId, now });
  const overdueAgreements = await db.paymentAgreement.findMany({
    where: {
      status: 'ACTIVE',
      installments: { some: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueOn: { lt: now } } },
    },
    select: {
      id: true,
      enrollment: {
        select: { id: true, student: { select: { givenName: true, familyName: true } } },
      },
    },
  });
  if (overdueAgreements.length > 0) {
    const ops = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
    for (const a of overdueAgreements) {
      const r = await notifyMany(institutionId, ops, {
        type: 'agreement_overdue',
        title: 'Acuerdo de pago incumplido',
        body: `${a.enrollment.student.givenName} ${a.enrollment.student.familyName} tiene una cuota del acuerdo vencida.`,
        href: `/cartera/${a.enrollment.id}`,
        dedupeKey: `agreement_overdue:${a.id}:${day(now)}`,
      });
      report.agreementOverdueAlerts += r.created;
    }
  }

  // 4. Cuotas vencidas → pagador (solo con la política encendida).
  const policy = await getPolicy({ institutionId });
  if (policy.notifyPayerOnOverdue) {
    const overdue = await db.installment.findMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueOn: { lt: now } },
      select: {
        id: true,
        position: true,
        amount: true,
        dueOn: true,
        paymentPlan: {
          select: {
            payerType: true,
            payerPerson: { select: { id: true, givenName: true, email: true } },
            enrollment: { select: { cohort: { select: { code: true } } } },
          },
        },
      },
    });
    const mailer = isMailConfigured()
      ? getMailer({
          emailFromName: institution.emailFromName,
          supportEmail: institution.supportEmail,
        })
      : null;
    for (const i of overdue) {
      const payer = i.paymentPlan.payerPerson;
      if (i.paymentPlan.payerType !== 'PERSON' || !payer) continue;
      const r = await notify(institutionId, {
        personId: payer.id,
        type: 'overdue_reminder',
        title: 'Tienes una cuota vencida',
        body: `La cuota ${i.position} de ${i.paymentPlan.enrollment.cohort.code} ($${i.amount.toNumber().toLocaleString('es-CO')}) venció el ${day(i.dueOn)}. Puedes pagarla en «Mi cuenta» o escribirnos para un acuerdo.`,
        href: '/aprender/mi-cuenta',
        dedupeKey: `overdue_reminder:${i.id}:${day(now)}`,
      });
      if (r.created) {
        report.overdueReminders++;
        if (mailer && payer.email) {
          try {
            await mailer.send({
              to: payer.email,
              subject: `${institution.name}: tienes una cuota vencida`,
              text: `Hola ${payer.givenName}. La cuota ${i.position} de ${i.paymentPlan.enrollment.cohort.code} venció el ${day(i.dueOn)}. Entra a tu cuenta para pagarla o escríbenos para acordar un plan. Tu acceso a las clases no cambia por esto.`,
              html: `<p>Hola ${payer.givenName}.</p><p>La cuota ${i.position} de ${i.paymentPlan.enrollment.cohort.code} venció el ${day(i.dueOn)}. Entra a tu cuenta para pagarla o escríbenos para acordar un plan.</p><p>Tu acceso a las clases no cambia por esto.</p>`,
            });
          } catch (err) {
            logger.warn({
              event: 'job-overdue-mail-failed',
              installmentId: i.id,
              error: String(err),
            });
          }
        }
      }
    }
  }

  // 5. Sesiones en vivo en las próximas 24 h.
  const soon = await db.liveSession.findMany({
    where: {
      archivedAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 3600 * 1000) },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      cohort: {
        select: { enrollments: { where: { status: 'ACTIVE' }, select: { studentId: true } } },
      },
    },
  });
  for (const s of soon) {
    const r = await notifyMany(
      institutionId,
      s.cohort.enrollments.map((e) => e.studentId),
      {
        type: 'live_session_soon',
        title: `Mañana: ${s.title}`,
        body: `Tu sesión en vivo «${s.title}» empieza el ${s.startsAt.toISOString().slice(0, 16).replace('T', ' ')} (UTC). El enlace se activa 15 minutos antes en tu calendario.`,
        href: '/aprender/calendario',
        dedupeKey: `live_session_soon:${s.id}`,
      }
    );
    report.liveSessionReminders += r.created;
  }

  // 6. Conciliación de pasarela: pagos GATEWAY sin confirmar de más de una hora.
  const stale = await db.payment.findMany({
    where: {
      method: 'GATEWAY',
      confirmedAt: null,
      voidedAt: null,
      createdAt: { lt: new Date(now.getTime() - 3600 * 1000) },
      gatewayRef: { not: null },
    },
    select: {
      id: true,
      gatewayRef: true,
      amount: true,
      installment: {
        select: {
          amount: true,
          payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
        },
      },
    },
  });
  for (const p of stale) {
    if (!p.gatewayRef) continue;
    try {
      const tx = await fetchTransaction(p.gatewayRef);
      if (!tx) continue;
      const paid = p.installment.payments
        .filter((x) => x.confirmedAt && !x.voidedAt)
        .reduce((s, x) => s + x.amount.toNumber(), 0);
      const pending = p.installment.amount.toNumber() - paid;
      if (
        tx.status === 'APPROVED' &&
        Math.round(tx.amount_in_cents / 100) === p.amount.toNumber() &&
        p.amount.toNumber() === pending
      ) {
        await confirmPayment({ institutionId, actorId: null, paymentId: p.id, now });
        report.gatewayReconciled++;
      }
    } catch (err) {
      logger.warn({ event: 'job-reconcile-failed', paymentId: p.id, error: String(err) });
    }
  }

  await db.auditLog.create({
    data: {
      institutionId,
      actorId: null,
      entity: 'job',
      entityId: day(now),
      action: 'daily',
      after: { ...report },
      occurredAt: now,
    },
  });
  return report;
}
