/**
 * La habilitación de componentes por matrícula (3/10, decisión del cliente).
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md (§ componentes), endpoints.md.
 *
 * El primer componente de la ruta está abierto; cada uno de los siguientes espera a que
 * operación lo habilite con un clic desde la ficha de la matrícula, cuando el estudiante lo
 * pide. Las fechas, opcionales, acotan la ventana del componente. Quien decide si está abierto
 * es `moduleAccess` (outline.ts), la misma regla que ve el estudiante.
 *
 * Es acceso académico y no mira cartera: la regla «la mora no toca el acceso» sigue en
 * RestrictionPolicy. Que operación habilite «cuando hay pago» es su decisión, no de este código.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { notify } from '@/features/notifications/server/notifications.service';
import { moduleAccess, type ModuleAccess } from '@/features/learn/server/outline';
import { closeRequests } from '@/features/requests/server/requests.service';

export interface ModuleAccessRow {
  moduleId: string;
  name: string;
  position: number;
  /** El primero de la ruta de esta matrícula: abierto sin habilitación. */
  first: boolean;
  state: ModuleAccess['state'];
  unlockedAt: string | null;
  unlockedByName: string | null;
  /** Día en Bogotá, AAAA-MM-DD; nulo sin límite. */
  availableFrom: string | null;
  availableUntil: string | null;
  /** ISO: el estudiante pidió habilitarlo y sigue sin resolver (6/10). */
  requestedAt: string | null;
}

export interface ModuleAccessList {
  /** En progresión `FREE` la habilitación no aplica: todo está abierto. */
  applies: boolean;
  modules: ModuleAccessRow[];
}

const bogotaDay = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    : null;
/** Las fechas se escriben como días en Bogotá: desde las 00:00 del primero hasta las 23:59 del último. */
const startOfDay = (day: string) => new Date(`${day}T00:00:00.000-05:00`);
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999-05:00`);

async function loadEnrollment(institutionId: string, enrollmentId: string) {
  const db = createTenantClient(institutionId);
  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      id: true,
      studentId: true,
      startsAtModule: true,
      cohort: { select: { programId: true, progression: true } },
    },
  });
  if (!enrollment) throw new APIError('Not found', 'NOT_FOUND');
  return enrollment;
}

export async function listModuleAccess({
  institutionId,
  enrollmentId,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId: string;
  now?: Date;
}): Promise<ModuleAccessList> {
  const db = createTenantClient(institutionId);
  const enrollment = await loadEnrollment(institutionId, enrollmentId);
  const progression = enrollment.cohort.progression === 'FREE' ? 'FREE' : 'LINEAR';

  const [modules, unlocks, requests] = await Promise.all([
    db.module.findMany({
      where: {
        programId: enrollment.cohort.programId,
        archivedAt: null,
        position: { gte: enrollment.startsAtModule ?? 1 },
      },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, position: true },
    }),
    db.enrollmentModule.findMany({
      where: { enrollmentId },
      select: {
        moduleId: true,
        unlockedAt: true,
        availableFrom: true,
        availableUntil: true,
        unlockedBy: { select: { givenName: true, familyName: true } },
      },
    }),
    db.accessRequest.findMany({
      where: { enrollmentId, kind: 'UNLOCK', status: 'PENDING' },
      select: { moduleId: true, createdAt: true },
    }),
  ]);
  const unlockOf = new Map(unlocks.map((row) => [row.moduleId, row]));
  const requestOf = new Map(requests.map((row) => [row.moduleId, row.createdAt.toISOString()]));

  return {
    applies: progression === 'LINEAR',
    modules: modules.map((component, index) => {
      const unlock = unlockOf.get(component.id) ?? null;
      return {
        moduleId: component.id,
        name: component.name,
        position: component.position,
        first: index === 0,
        state: moduleAccess({ first: index === 0, unlock, progression, now }).state,
        unlockedAt: unlock ? unlock.unlockedAt.toISOString() : null,
        unlockedByName: unlock?.unlockedBy
          ? `${unlock.unlockedBy.givenName} ${unlock.unlockedBy.familyName}`
          : null,
        availableFrom: bogotaDay(unlock?.availableFrom ?? null),
        availableUntil: bogotaDay(unlock?.availableUntil ?? null),
        requestedAt: requestOf.get(component.id) ?? null,
      };
    }),
  };
}

/**
 * Habilita, cambia las fechas o vuelve a bloquear un componente para una matrícula. Audita
 * (`enrollment_module.unlock|update|lock`) y, al habilitar, avisa al estudiante.
 *
 * Idempotente: habilitar lo ya habilitado con las mismas fechas no escribe ni avisa; bloquear
 * lo bloqueado tampoco.
 */
export async function setModuleAccess({
  institutionId,
  actorId,
  enrollmentId,
  moduleId,
  unlocked,
  availableFrom = null,
  availableUntil = null,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  enrollmentId: string;
  moduleId: string;
  unlocked: boolean;
  /** Días en Bogotá, AAAA-MM-DD, ya validados por la ruta. */
  availableFrom?: string | null;
  availableUntil?: string | null;
  now?: Date;
}): Promise<{ changed: boolean; state: ModuleAccess['state'] }> {
  const db = createTenantClient(institutionId);
  const enrollment = await loadEnrollment(institutionId, enrollmentId);

  if (availableFrom && availableUntil && availableFrom > availableUntil) {
    throw new APIError('La fecha de inicio es posterior a la de cierre', 'VALIDATION_ERROR');
  }

  const component = await db.module.findFirst({
    where: { id: moduleId, programId: enrollment.cohort.programId, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!component) throw new APIError('Not found', 'NOT_FOUND');

  const existing = await db.enrollmentModule.findFirst({
    where: { enrollmentId, moduleId },
    select: { id: true, availableFrom: true, availableUntil: true },
  });

  const from = availableFrom ? startOfDay(availableFrom) : null;
  const until = availableUntil ? endOfDay(availableUntil) : null;
  const same = (a: Date | null, b: Date | null) =>
    (a?.getTime() ?? null) === (b?.getTime() ?? null);
  const stateOf = (unlock: { availableFrom: Date | null; availableUntil: Date | null }) =>
    moduleAccess({ first: false, unlock, progression: 'LINEAR', now }).state;

  if (!unlocked) {
    if (!existing) return { changed: false, state: 'LOCKED' };
    await db.$transaction(async (tx) => {
      await tx.enrollmentModule.delete({ where: { id: existing.id } });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'enrollment_module',
          entityId: existing.id,
          action: 'lock',
          before: {
            availableFrom: existing.availableFrom?.toISOString() ?? null,
            availableUntil: existing.availableUntil?.toISOString() ?? null,
          },
          after: { enrollmentId, moduleId },
          occurredAt: now,
        },
      });
    });
    return { changed: true, state: 'LOCKED' };
  }

  if (existing && same(existing.availableFrom, from) && same(existing.availableUntil, until)) {
    return { changed: false, state: stateOf(existing) };
  }

  await db.$transaction(async (tx) => {
    const row = existing
      ? await tx.enrollmentModule.update({
          where: { id: existing.id },
          data: { availableFrom: from, availableUntil: until },
          select: { id: true },
        })
      : await tx.enrollmentModule.create({
          data: {
            institutionId,
            enrollmentId,
            moduleId,
            unlockedAt: now,
            unlockedById: actorId,
            availableFrom: from,
            availableUntil: until,
          },
          select: { id: true },
        });

    await closeRequests(tx, { kind: 'UNLOCK', enrollmentId, moduleId }, { actorId, now });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'enrollment_module',
        entityId: row.id,
        action: existing ? 'update' : 'unlock',
        before: existing
          ? {
              availableFrom: existing.availableFrom?.toISOString() ?? null,
              availableUntil: existing.availableUntil?.toISOString() ?? null,
            }
          : {},
        after: {
          enrollmentId,
          moduleId,
          availableFrom: from?.toISOString() ?? null,
          availableUntil: until?.toISOString() ?? null,
        },
        occurredAt: now,
      },
    });
  });

  // El aviso, fuera de la transacción: no se deshace con un ROLLBACK. Solo al habilitar.
  if (!existing) {
    await notify(institutionId, {
      personId: enrollment.studentId,
      type: 'module_unlocked',
      title: 'Ya puedes seguir con el siguiente componente',
      body:
        from && from > now
          ? `«${component.name}» quedó habilitado para ti. Se abre el ${availableFrom}.`
          : `«${component.name}» quedó habilitado para ti. Entra a tu ruta para continuar.`,
      href: '/aprender',
      dedupeKey: `module_unlocked:${enrollmentId}:${moduleId}:${now.toISOString().slice(0, 10)}`,
    });
  }

  return { changed: true, state: stateOf({ availableFrom: from, availableUntil: until }) };
}
