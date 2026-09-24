/**
 * Sesiones en vivo de una cohorte.
 * SSOT: plan/08-aprender-y-evaluar.md:78-83 (§5), endpoints.md:80, prisma `LiveSession`.
 *
 * Alta y edición por cohorte (`cohort.manage`), auditadas. El estudiante las ve en
 * `/aprender/calendario` con «Unirse» activo desde 15 minutos antes; los recordatorios a
 * 24 h y 1 h los manda el job diario (Fase 5) con `dedupeKey`. La grabación es un recurso de
 * Vimeo (`recordingId` → `MediaAsset`) y aparece en la biblioteca.
 *
 * `url` tiene que ser https: un enlace `javascript:` en un botón «Unirse» es exactamente lo
 * que la validación de aquí impide.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export interface LiveSessionRow {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  url: string;
  recordingId: string | null;
  archived: boolean;
}

export interface LiveSessionInput {
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  url: string;
  recordingId: string | null;
}

function validate(input: LiveSessionInput) {
  if (input.endsAt <= input.startsAt) {
    throw new APIError('La sesión tiene que terminar después de empezar', 'VALIDATION_ERROR');
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new APIError('La dirección de la sesión no es válida', 'VALIDATION_ERROR');
  }
  if (parsed.protocol !== 'https:') {
    throw new APIError(
      'La dirección de la sesión tiene que empezar por https://',
      'VALIDATION_ERROR'
    );
  }
}

const toRow = (s: {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  url: string;
  recordingId: string | null;
  archivedAt: Date | null;
}): LiveSessionRow => ({
  id: s.id,
  title: s.title,
  description: s.description,
  startsAt: s.startsAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
  url: s.url,
  recordingId: s.recordingId,
  archived: s.archivedAt !== null,
});

export async function listLiveSessions({
  institutionId,
  cohortId,
  includeArchived = false,
}: {
  institutionId: string;
  cohortId: string;
  includeArchived?: boolean;
}): Promise<LiveSessionRow[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.liveSession.findMany({
    where: { cohortId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: { startsAt: 'asc' },
  });
  return rows.map(toRow);
}

export async function createLiveSession({
  institutionId,
  actorId,
  cohortId,
  input,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  input: LiveSessionInput;
  now?: Date;
}): Promise<LiveSessionRow> {
  validate(input);
  const db = createTenantClient(institutionId);
  const cohort = await db.cohort.findFirst({ where: { id: cohortId }, select: { id: true } });
  if (!cohort) throw new APIError('Not found', 'NOT_FOUND');

  if (input.recordingId) await requireVideo(institutionId, input.recordingId);

  return db.$transaction(async (tx) => {
    const row = await tx.liveSession.create({
      data: { institutionId, cohortId, createdById: actorId, ...input },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'live_session',
        entityId: row.id,
        action: 'created',
        after: { title: input.title, startsAt: input.startsAt.toISOString(), url: input.url },
        occurredAt: now,
      },
    });
    return toRow(row);
  });
}

export async function updateLiveSession({
  institutionId,
  actorId,
  cohortId,
  sessionId,
  input,
  archive,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  sessionId: string;
  input: Partial<LiveSessionInput>;
  /** `true` archiva (deja de verse), `false` la restaura. */
  archive?: boolean;
  now?: Date;
}): Promise<LiveSessionRow> {
  const db = createTenantClient(institutionId);
  const existing = await db.liveSession.findFirst({ where: { id: sessionId, cohortId } });
  if (!existing) throw new APIError('Not found', 'NOT_FOUND');

  const merged: LiveSessionInput = {
    title: input.title ?? existing.title,
    description: input.description === undefined ? existing.description : input.description,
    startsAt: input.startsAt ?? existing.startsAt,
    endsAt: input.endsAt ?? existing.endsAt,
    url: input.url ?? existing.url,
    recordingId: input.recordingId === undefined ? existing.recordingId : input.recordingId,
  };
  validate(merged);
  if (merged.recordingId && merged.recordingId !== existing.recordingId) {
    await requireVideo(institutionId, merged.recordingId);
  }

  return db.$transaction(async (tx) => {
    const row = await tx.liveSession.update({
      where: { id: existing.id },
      data: {
        ...merged,
        ...(archive === undefined ? {} : { archivedAt: archive ? now : null }),
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'live_session',
        entityId: row.id,
        action: 'updated',
        before: {
          title: existing.title,
          startsAt: existing.startsAt.toISOString(),
          url: existing.url,
          archived: existing.archivedAt !== null,
        },
        after: {
          title: row.title,
          startsAt: row.startsAt.toISOString(),
          url: row.url,
          archived: row.archivedAt !== null,
        },
        occurredAt: now,
      },
    });
    return toRow(row);
  });
}

/** La grabación tiene que ser un video registrado (Vimeo) de esta institución. */
async function requireVideo(institutionId: string, mediaAssetId: string) {
  const db = createTenantClient(institutionId);
  const asset = await db.mediaAsset.findFirst({
    where: { id: mediaAssetId, kind: 'VIDEO' },
    select: { id: true },
  });
  if (!asset) throw new APIError('La grabación no es un video registrado', 'VALIDATION_ERROR');
}

// ─────────────────────────── calendario del estudiante ───────────────────────────

export interface CalendarItem {
  kind: 'COHORT_START' | 'COHORT_END' | 'ACCESS_UNTIL' | 'ASSESSMENT_DUE' | 'LIVE_SESSION';
  id: string;
  title: string;
  at: string;
  endsAt: string | null;
  href: string | null;
  /** Sesión en vivo: si «Unirse» está activo (desde 15 min antes hasta el final). */
  joinable: boolean;
  description: string | null;
}

/**
 * Las fechas que le importan al estudiante: cohorte, `dueAt` de evaluaciones y sesiones en
 * vivo. Una lista ordenada, no un calendario dibujado: en un celular, una lista se lee; una
 * cuadrícula de mes con tres eventos, no.
 */
export async function getCalendarForEnrollment({
  institutionId,
  enrollmentId,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId: string;
  now?: Date;
}): Promise<CalendarItem[]> {
  const db = createTenantClient(institutionId);
  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      accessUntil: true,
      cohort: {
        select: {
          id: true,
          code: true,
          startsOn: true,
          endsOn: true,
          assessmentAssignments: {
            where: { dueAt: { not: null } },
            select: { id: true, dueAt: true, assessment: { select: { title: true } } },
          },
          liveSessions: {
            where: { archivedAt: null },
            select: {
              id: true,
              title: true,
              description: true,
              startsAt: true,
              endsAt: true,
              url: true,
            },
          },
        },
      },
    },
  });
  if (!e) return [];

  const JOIN_BEFORE_MS = 15 * 60 * 1000;
  const items: CalendarItem[] = [
    {
      kind: 'COHORT_START',
      id: `start-${e.cohort.id}`,
      title: e.cohort.code,
      at: e.cohort.startsOn.toISOString(),
      endsAt: null,
      href: null,
      joinable: false,
      description: null,
    },
    {
      kind: 'COHORT_END',
      id: `end-${e.cohort.id}`,
      title: e.cohort.code,
      at: e.cohort.endsOn.toISOString(),
      endsAt: null,
      href: null,
      joinable: false,
      description: null,
    },
    {
      kind: 'ACCESS_UNTIL',
      id: `access-${enrollmentId}`,
      title: e.cohort.code,
      at: e.accessUntil.toISOString(),
      endsAt: null,
      href: null,
      joinable: false,
      description: null,
    },
    ...e.cohort.assessmentAssignments.map((a): CalendarItem => ({
      kind: 'ASSESSMENT_DUE',
      id: a.id,
      title: a.assessment.title,
      at: a.dueAt!.toISOString(),
      endsAt: null,
      href: `/aprender/examen/${a.id}`,
      joinable: false,
      description: null,
    })),
    ...e.cohort.liveSessions.map((s): CalendarItem => ({
      kind: 'LIVE_SESSION',
      id: s.id,
      title: s.title,
      at: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      href: s.url,
      joinable: now.getTime() >= s.startsAt.getTime() - JOIN_BEFORE_MS && now < s.endsAt,
      description: s.description,
    })),
  ];

  return items.sort((a, b) => a.at.localeCompare(b.at));
}
