/**
 * Etapas por cuota (20/11): la cuota pagada habilita sus componentes.
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §3.
 *
 * Nunca aplica a una matrícula de menor y nunca cierra lo que ya está abierto. Qué cuota abre
 * qué componente lo dice `stage-installments.ts`.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { notify } from '@/features/notifications/server/notifications.service';
import { closeRequests } from '@/features/requests/server/requests.service';

/** Habilita los componentes de una cuota pagada. Idempotente; devuelve los que abrió. */
export async function openPaidStages({
  institutionId,
  installmentId,
  now = new Date(),
}: {
  institutionId: string;
  installmentId: string;
  now?: Date;
}): Promise<string[]> {
  const db = createTenantClient(institutionId);
  const installment = await db.installment.findFirst({
    where: { id: installmentId, status: 'PAID' },
    select: {
      unlockModuleIds: true,
      paymentPlan: {
        select: {
          enrollment: {
            select: {
              id: true,
              studentId: true,
              isMinorAtEnrollment: true,
              cohort: { select: { programId: true } },
            },
          },
        },
      },
    },
  });
  const ids = installment?.unlockModuleIds ?? [];
  if (!installment || ids.length === 0) return [];
  const enrollment = installment.paymentPlan.enrollment;
  if (enrollment.isMinorAtEnrollment) return [];

  const [components, unlocked] = await Promise.all([
    db.module.findMany({
      where: { id: { in: ids }, programId: enrollment.cohort.programId, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    db.enrollmentModule.findMany({
      where: { enrollmentId: enrollment.id, moduleId: { in: ids } },
      select: { moduleId: true },
    }),
  ]);
  const already = new Set(unlocked.map((row) => row.moduleId));
  const opened = components.filter((component) => !already.has(component.id));
  if (opened.length === 0) return [];

  await db.$transaction(async (tx) => {
    for (const component of opened) {
      const row = await tx.enrollmentModule.create({
        data: {
          institutionId,
          enrollmentId: enrollment.id,
          moduleId: component.id,
          unlockedAt: now,
        },
        select: { id: true },
      });
      await closeRequests(
        tx,
        { kind: 'UNLOCK', enrollmentId: enrollment.id, moduleId: component.id },
        { actorId: null, now }
      );
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId: null,
          entity: 'enrollment_module',
          entityId: row.id,
          action: 'unlock',
          before: {},
          after: {
            enrollmentId: enrollment.id,
            moduleId: component.id,
            reason: 'installment_paid',
            installmentId,
          },
          occurredAt: now,
        },
      });
    }
  });

  const names = opened.map((component) => `«${component.name}»`).join(', ');
  await notify(institutionId, {
    personId: enrollment.studentId,
    type: 'module_unlocked',
    title: 'Tu pago abrió lo que sigue',
    body: `${names} ya está en tu ruta. Entra para continuar.`,
    href: '/aprender',
    dedupeKey: `stage_opened:${installmentId}`,
  });

  return opened.map((component) => component.id);
}
