/**
 * Ajustes razonables (la parte ejecutable del PIAR), por matrícula.
 * SSOT: reference/04-business-logic/ajustes-razonables.md, plan/08-aprender-y-evaluar.md:88-91
 * (§8), reference/02-api/endpoints.md:94, prisma `Accommodation`.
 *
 * Tres reglas que este archivo sostiene:
 * - **el diagnóstico no entra**: aquí se guarda qué ajuste aplica, nunca por qué; `notes`
 *   es para indicaciones pedagógicas y el formulario lo advierte;
 * - **todo cambio se audita** (`accommodation.created|updated`) con el antes y el después:
 *   un intento de febrero se explica con los ajustes de febrero (`appliedAccommodation`), y
 *   el historial dice quién cambió qué en marzo;
 * - **no segrega**: nada de esto sale en listados; solo en el detalle de la matrícula y solo
 *   para quien tiene `accommodation.manage`.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export interface AccommodationView {
  extraTimeFactor: number;
  exemptFromTimer: boolean;
  allowedAttemptsBonus: number;
  requiresCaptions: boolean;
  allowsAssistiveTech: boolean;
  notes: string | null;
  updatedAt: string;
  createdByName: string | null;
}

export interface AccommodationInput {
  extraTimeFactor: number;
  exemptFromTimer: boolean;
  allowedAttemptsBonus: number;
  requiresCaptions: boolean;
  allowsAssistiveTech: boolean;
  notes: string | null;
}

export interface AccommodationHistoryItem {
  id: string;
  action: 'created' | 'updated';
  actorName: string | null;
  occurredAt: string;
  /** Campos que cambiaron, con el valor anterior y el nuevo, ya como texto. */
  changes: Array<{ field: string; before: string; after: string }>;
}

const FIELDS: ReadonlyArray<keyof AccommodationInput> = [
  'extraTimeFactor',
  'exemptFromTimer',
  'allowedAttemptsBonus',
  'requiresCaptions',
  'allowsAssistiveTech',
  'notes',
];

const asText = (v: unknown) => (v === null || v === undefined ? '—' : String(v));

function toInput(row: {
  extraTimeFactor: { toNumber(): number };
  exemptFromTimer: boolean;
  allowedAttemptsBonus: number;
  requiresCaptions: boolean;
  allowsAssistiveTech: boolean;
  notes: string | null;
}): AccommodationInput {
  return {
    extraTimeFactor: row.extraTimeFactor.toNumber(),
    exemptFromTimer: row.exemptFromTimer,
    allowedAttemptsBonus: row.allowedAttemptsBonus,
    requiresCaptions: row.requiresCaptions,
    allowsAssistiveTech: row.allowsAssistiveTech,
    notes: row.notes,
  };
}

export async function getAccommodation({
  institutionId,
  enrollmentId,
}: {
  institutionId: string;
  enrollmentId: string;
}): Promise<AccommodationView | null> {
  const db = createTenantClient(institutionId);
  const row = await db.accommodation.findFirst({
    where: { enrollmentId },
    select: {
      extraTimeFactor: true,
      exemptFromTimer: true,
      allowedAttemptsBonus: true,
      requiresCaptions: true,
      allowsAssistiveTech: true,
      notes: true,
      updatedAt: true,
      createdById: true,
    },
  });
  if (!row) return null;
  const creator = await db.person.findFirst({
    where: { id: row.createdById },
    select: { givenName: true, familyName: true },
  });
  return {
    ...toInput(row),
    updatedAt: row.updatedAt.toISOString(),
    createdByName: creator ? `${creator.givenName} ${creator.familyName}` : null,
  };
}

/** Crea o actualiza. Idempotente: guardar lo mismo no escribe ni audita nada. */
export async function upsertAccommodation({
  institutionId,
  actorId,
  enrollmentId,
  input,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  enrollmentId: string;
  input: AccommodationInput;
  now?: Date;
}): Promise<{ changed: boolean }> {
  const db = createTenantClient(institutionId);

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: { id: true, studentId: true },
  });
  if (!enrollment) throw new APIError('Not found', 'NOT_FOUND');

  const existing = await db.accommodation.findFirst({
    where: { enrollmentId },
    select: {
      id: true,
      extraTimeFactor: true,
      exemptFromTimer: true,
      allowedAttemptsBonus: true,
      requiresCaptions: true,
      allowsAssistiveTech: true,
      notes: true,
    },
  });

  const before = existing ? toInput(existing) : null;
  const changedFields = FIELDS.filter((f) => (before ? before[f] : undefined) !== input[f]);
  if (before && changedFields.length === 0) return { changed: false };

  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.accommodation.update({ where: { id: existing.id }, data: { ...input } });
    } else {
      await tx.accommodation.create({
        data: {
          institutionId,
          studentId: enrollment.studentId,
          enrollmentId,
          createdById: actorId,
          ...input,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'accommodation',
        entityId: enrollmentId,
        action: existing ? 'updated' : 'created',
        before: before ? Object.fromEntries(changedFields.map((f) => [f, before[f]])) : undefined,
        after: Object.fromEntries((existing ? changedFields : FIELDS).map((f) => [f, input[f]])),
        occurredAt: now,
      },
    });
  });

  return { changed: true };
}

/** El historial, desde `AuditLog`: quién cambió qué y cuándo. */
export async function listAccommodationHistory({
  institutionId,
  enrollmentId,
  take = 20,
}: {
  institutionId: string;
  enrollmentId: string;
  take?: number;
}): Promise<AccommodationHistoryItem[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.auditLog.findMany({
    where: { entity: 'accommodation', entityId: enrollmentId },
    orderBy: { occurredAt: 'desc' },
    take,
    select: { id: true, action: true, actorId: true, before: true, after: true, occurredAt: true },
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await db.person.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const nameOf = new Map(actors.map((a) => [a.id, `${a.givenName} ${a.familyName}`]));

  return rows.map((r) => {
    const before = (r.before ?? {}) as Record<string, unknown>;
    const after = (r.after ?? {}) as Record<string, unknown>;
    return {
      id: r.id.toString(),
      action: r.action === 'created' ? 'created' : 'updated',
      actorName: r.actorId ? (nameOf.get(r.actorId) ?? null) : null,
      occurredAt: r.occurredAt.toISOString(),
      changes: Object.keys(after).map((field) => ({
        field,
        before: asText(before[field]),
        after: asText(after[field]),
      })),
    };
  });
}

// ─────────────────────────── reporte (Decreto 1421) ───────────────────────────

export interface InclusionReportRow {
  cohortId: string;
  cohortCode: string;
  cohortName: string;
  activeEnrollments: number;
  withAccommodation: number;
  extraTime: number;
  exemptFromTimer: number;
  extraAttempts: number;
  requiresCaptions: number;
  noAssistiveTech: number;
  changesInPeriod: number;
}

export interface InclusionReport {
  period: { from: string; to: string };
  totals: { withAccommodation: number; changesInPeriod: number };
  byAuthorizer: Array<{ name: string; count: number }>;
  rows: InclusionReportRow[];
}

/**
 * El reporte del Decreto 1421: ajustes vigentes por cohorte, por tipo, y cuántos cambios
 * hubo en el periodo, con quién los autorizó. Solo conteos: aquí no hay nombres de
 * estudiantes (reportes.md «lo que no se reporta»).
 */
export async function getInclusionReport({
  institutionId,
  from,
  to,
}: {
  institutionId: string;
  from: Date;
  to: Date;
}): Promise<InclusionReport> {
  const db = createTenantClient(institutionId);
  const [cohorts, accommodations, changes] = await Promise.all([
    db.cohort.findMany({
      where: { status: { in: ['PLANNED', 'OPEN'] } },
      orderBy: { startsOn: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        enrollments: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    }),
    db.accommodation.findMany({
      where: { enrollment: { status: 'ACTIVE' } },
      select: {
        id: true,
        createdById: true,
        extraTimeFactor: true,
        exemptFromTimer: true,
        allowedAttemptsBonus: true,
        requiresCaptions: true,
        allowsAssistiveTech: true,
        enrollment: { select: { cohortId: true } },
      },
    }),
    db.auditLog.findMany({
      where: { entity: 'accommodation', occurredAt: { gte: from, lte: to } },
      select: { entityId: true, actorId: true, occurredAt: true },
    }),
  ]);

  const enrollmentCohort = new Map<string, string>();
  for (const c of cohorts) for (const e of c.enrollments) enrollmentCohort.set(e.id, c.id);

  const rows: InclusionReportRow[] = cohorts.map((c) => {
    const own = accommodations.filter((a) => a.enrollment.cohortId === c.id);
    return {
      cohortId: c.id,
      cohortCode: c.code,
      cohortName: c.name,
      activeEnrollments: c.enrollments.length,
      withAccommodation: own.length,
      extraTime: own.filter((a) => a.extraTimeFactor.toNumber() > 1).length,
      exemptFromTimer: own.filter((a) => a.exemptFromTimer).length,
      extraAttempts: own.filter((a) => a.allowedAttemptsBonus > 0).length,
      requiresCaptions: own.filter((a) => a.requiresCaptions).length,
      noAssistiveTech: own.filter((a) => !a.allowsAssistiveTech).length,
      changesInPeriod: changes.filter((ch) => enrollmentCohort.get(ch.entityId) === c.id).length,
    };
  });

  const authorizerIds = [...new Set(accommodations.map((a) => a.createdById))];
  const people = authorizerIds.length
    ? await db.person.findMany({
        where: { id: { in: authorizerIds } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const nameOf = new Map(people.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));
  const byAuthorizer = authorizerIds
    .map((id) => ({
      name: nameOf.get(id) ?? 'Sin nombre',
      count: accommodations.filter((a) => a.createdById === id).length,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    totals: { withAccommodation: accommodations.length, changesInPeriod: changes.length },
    byAuthorizer,
    rows,
  };
}
