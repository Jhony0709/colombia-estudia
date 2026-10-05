/**
 * Las asignaciones de una cohorte —qué versión de cada tema y examen estudia— y el cambio
 * de versión (ola 2 UX, 23/9).
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md («La asignación es
 * (cohorte, tema), no (cohorte, versión)»), reference/02-api/endpoints.md
 * (`PATCH /api/cohorts/assignments/[id]`).
 *
 * El `PATCH` estaba en el contrato desde el principio y **no existía**: se descubrió al
 * construir la pestaña «Ruta» de la cohorte. Regla al cambiar la versión de un tema: el
 * `COMPLETED` sobrevive salvo que la versión nueva tenga `invalidatesProgress`, y entonces
 * vuelve a `IN_PROGRESS` con la evidencia conservada y se avisa al estudiante. Para un
 * examen, la versión nueva solo afecta a intentos nuevos.
 *
 * Desde el 27/9 la asignación **sigue sola** a la versión publicada al publicar
 * (`version-propagation.ts`), salvo que esté fijada (`pinnedVersion`). Este `PATCH` queda para
 * las fijadas —o las que quedaron atrás por otra razón— y para fijar o soltar.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { sortItems, workshopStart } from '@/features/learn/server/outline';
import { notifyMany } from '@/features/notifications/server/notifications.service';

export interface CohortAssignmentItem {
  kind: 'LESSON' | 'ASSESSMENT';
  assignmentId: string;
  /** Id del tema o del examen. */
  id: string;
  title: string;
  moduleId: string | null;
  lessonId: string | null;
  /** El taller (asignatura), para ordenar igual que la ruta del estudiante (3/10). */
  subjectId: string | null;
  subjectName: string | null;
  /** El taller que empieza en este ítem (4/10), para la etiqueta de grupo; nulo si sigue el mismo. */
  workshop: string | null;
  position: number;
  /** La versión que estudia la cohorte. */
  assigned: { id: string; number: number };
  /** La publicada más alta; igual a la asignada si está al día. */
  latest: { id: string; number: number; invalidatesProgress: boolean } | null;
  /** Fijada en su versión: no sigue a la publicada al publicar (27/9). */
  pinned: boolean;
  availableFrom: string;
  availableUntil: string | null;
}

export interface CohortAssignmentsModule {
  id: string;
  name: string;
  position: number;
  items: CohortAssignmentItem[];
}

export interface CohortAssignments {
  modules: CohortAssignmentsModule[];
  /** Exámenes sin módulo (diagnósticos del programa). */
  programItems: CohortAssignmentItem[];
  /** Cuántas asignaciones tienen una versión publicada más nueva que la suya. */
  outdated: number;
}

const iso = (d: Date) => d.toISOString();

export async function listCohortAssignments({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<CohortAssignments | null> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      programId: true,
      program: {
        select: {
          modules: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: { id: true, name: true, position: true },
          },
        },
      },
    },
  });
  if (!cohort) return null;

  const [lessons, assessments] = await Promise.all([
    db.lessonAssignment.findMany({
      where: { cohortId },
      select: {
        id: true,
        availableFrom: true,
        availableUntil: true,
        pinnedVersion: true,
        lessonVersion: { select: { id: true, number: true } },
        lesson: {
          select: {
            id: true,
            title: true,
            moduleId: true,
            subjectId: true,
            subject: { select: { name: true } },
            position: true,
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { number: 'desc' },
              take: 1,
              select: { id: true, number: true, invalidatesProgress: true },
            },
          },
        },
      },
    }),
    db.assessmentAssignment.findMany({
      where: { cohortId },
      select: {
        id: true,
        availableFrom: true,
        dueAt: true,
        pinnedVersion: true,
        assessmentVersion: { select: { id: true, number: true } },
        assessment: {
          select: {
            id: true,
            title: true,
            moduleId: true,
            lessonId: true,
            subjectId: true,
            subject: { select: { name: true } },
            position: true,
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { number: 'desc' },
              take: 1,
              select: { id: true, number: true },
            },
          },
        },
      },
    }),
  ]);

  const items: CohortAssignmentItem[] = [
    ...lessons.map((a) => ({
      kind: 'LESSON' as const,
      assignmentId: a.id,
      id: a.lesson.id,
      title: a.lesson.title,
      moduleId: a.lesson.moduleId,
      lessonId: a.lesson.id,
      subjectId: a.lesson.subjectId,
      subjectName: a.lesson.subject.name,
      workshop: null,
      position: a.lesson.position,
      assigned: { id: a.lessonVersion.id, number: a.lessonVersion.number },
      latest: a.lesson.versions[0] ?? null,
      pinned: a.pinnedVersion,
      availableFrom: iso(a.availableFrom),
      availableUntil: a.availableUntil ? iso(a.availableUntil) : null,
    })),
    ...assessments.map((a) => ({
      kind: 'ASSESSMENT' as const,
      assignmentId: a.id,
      id: a.assessment.id,
      title: a.assessment.title,
      moduleId: a.assessment.moduleId,
      lessonId: a.assessment.lessonId,
      subjectId: a.assessment.subjectId,
      subjectName: a.assessment.subject?.name ?? null,
      workshop: null,
      position: a.assessment.position,
      assigned: { id: a.assessmentVersion.id, number: a.assessmentVersion.number },
      latest: a.assessment.versions[0]
        ? { ...a.assessment.versions[0], invalidatesProgress: false }
        : null,
      pinned: a.pinnedVersion,
      availableFrom: iso(a.availableFrom),
      availableUntil: a.dueAt ? iso(a.dueAt) : null,
    })),
  ];

  const modules = cohort.program.modules.map((module) => {
    const sorted = sortItems(items.filter((item) => item.moduleId === module.id));
    return {
      ...module,
      items: sorted.map((item, index) => ({ ...item, workshop: workshopStart(sorted, index) })),
    };
  });
  const programItems = items.filter((item) => item.moduleId === null);
  const outdated = items.filter(
    (item) => item.latest !== null && item.latest.number > item.assigned.number
  ).length;

  return { modules, programItems, outdated };
}

/**
 * Cambia la asignación a la versión publicada más alta. Audita `assignment.version_changed`
 * con antes/después; si la versión nueva de un tema `invalidatesProgress`, reabre los
 * `COMPLETED` (evidencia intacta) y avisa a cada estudiante.
 */
export async function updateAssignmentToLatest({
  institutionId,
  actorId,
  kind,
  assignmentId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  kind: 'lesson' | 'assessment';
  assignmentId: string;
  now?: Date;
}): Promise<{ from: number; to: number; reopened: number }> {
  const db = createTenantClient(institutionId);

  if (kind === 'assessment') {
    const a = await db.assessmentAssignment.findFirst({
      where: { id: assignmentId },
      select: {
        id: true,
        cohortId: true,
        assessmentVersion: { select: { number: true } },
        assessment: {
          select: {
            title: true,
            versions: {
              where: { status: 'PUBLISHED' },
              orderBy: { number: 'desc' },
              take: 1,
              select: { id: true, number: true },
            },
          },
        },
      },
    });
    if (!a) throw new APIError('Assignment not found', 'NOT_FOUND');
    const latest = a.assessment.versions[0];
    if (!latest || latest.number <= a.assessmentVersion.number) {
      throw new APIError('La cohorte ya tiene la versión publicada más reciente', 'CONFLICT');
    }
    await db.$transaction(async (tx) => {
      await tx.assessmentAssignment.update({
        where: { id: assignmentId },
        data: { assessmentVersionId: latest.id },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'assessment_assignment',
          entityId: assignmentId,
          action: 'version_changed',
          before: { number: a.assessmentVersion.number },
          after: { number: latest.number, cohortId: a.cohortId },
        },
      });
    });
    return { from: a.assessmentVersion.number, to: latest.number, reopened: 0 };
  }

  const a = await db.lessonAssignment.findFirst({
    where: { id: assignmentId },
    select: {
      id: true,
      cohortId: true,
      lessonVersion: { select: { number: true } },
      lesson: {
        select: {
          title: true,
          versions: {
            where: { status: 'PUBLISHED' },
            orderBy: { number: 'desc' },
            take: 1,
            select: { id: true, number: true, invalidatesProgress: true },
          },
        },
      },
    },
  });
  if (!a) throw new APIError('Assignment not found', 'NOT_FOUND');
  const latest = a.lesson.versions[0];
  if (!latest || latest.number <= a.lessonVersion.number) {
    throw new APIError('La cohorte ya tiene la versión publicada más reciente', 'CONFLICT');
  }

  const reopened = await db.$transaction(async (tx) => {
    await tx.lessonAssignment.update({
      where: { id: assignmentId },
      data: { lessonVersionId: latest.id },
    });

    let reopenedIds: string[] = [];
    if (latest.invalidatesProgress) {
      const completed = await tx.lessonProgress.findMany({
        where: { lessonAssignmentId: assignmentId, status: 'COMPLETED' },
        select: { id: true, studentId: true },
      });
      if (completed.length > 0) {
        await tx.lessonProgress.updateMany({
          where: { id: { in: completed.map((p) => p.id) } },
          data: { status: 'IN_PROGRESS', completedAt: null, lessonVersionId: latest.id },
        });
        reopenedIds = completed.map((p) => p.studentId);
      }
    }

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson_assignment',
        entityId: assignmentId,
        action: 'version_changed',
        before: { number: a.lessonVersion.number },
        after: {
          number: latest.number,
          cohortId: a.cohortId,
          invalidatesProgress: latest.invalidatesProgress,
          reopened: reopenedIds.length,
        },
      },
    });
    return reopenedIds;
  });

  if (reopened.length > 0) {
    await notifyMany(institutionId, [...new Set(reopened)], {
      type: 'lesson_reopened',
      title: 'Un tema que completaste cambió',
      body: `«${a.lesson.title}» tiene una versión nueva con cambios importantes. Vuelve a revisarlo para dejarlo completado.`,
      href: `/aprender/tema/${assignmentId}`,
      dedupeKey: `lesson_reopened:${assignmentId}:${latest.number}:${now.toISOString().slice(0, 10)}`,
    });
  }

  return { from: a.lessonVersion.number, to: latest.number, reopened: reopened.length };
}

/**
 * Fija la asignación en su versión o la suelta (27/9). Al soltar, si quedó atrás, se pone al
 * día en el mismo acto: soltar significa «quiero lo último», no «quiero lo último a partir de
 * la próxima publicación». Audita `assignment.pinned` / `assignment.unpinned`.
 */
export async function setAssignmentPinned({
  institutionId,
  actorId,
  kind,
  assignmentId,
  pinned,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  kind: 'lesson' | 'assessment';
  assignmentId: string;
  pinned: boolean;
  now?: Date;
}): Promise<{ pinned: boolean; from: number; to: number; reopened: number }> {
  const db = createTenantClient(institutionId);
  const select = { id: true, pinnedVersion: true, cohortId: true } as const;
  const where = { id: assignmentId };

  const current =
    kind === 'lesson'
      ? await db.lessonAssignment.findFirst({ where, select })
      : await db.assessmentAssignment.findFirst({ where, select });
  if (!current) throw new APIError('Assignment not found', 'NOT_FOUND');

  if (current.pinnedVersion !== pinned) {
    await db.$transaction(async (tx) => {
      const data = { pinnedVersion: pinned };
      if (kind === 'lesson') await tx.lessonAssignment.update({ where, data });
      else await tx.assessmentAssignment.update({ where, data });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: kind === 'lesson' ? 'lesson_assignment' : 'assessment_assignment',
          entityId: assignmentId,
          action: pinned ? 'pinned' : 'unpinned',
          after: { cohortId: current.cohortId },
        },
      });
    });
  }

  if (pinned) return { pinned, from: 0, to: 0, reopened: 0 };

  try {
    const moved = await updateAssignmentToLatest({
      institutionId,
      actorId,
      kind,
      assignmentId,
      now,
    });
    return { pinned, ...moved };
  } catch (error) {
    // Ya estaba al día: soltar no tiene nada que mover.
    if (error instanceof APIError && error.code === 'CONFLICT') {
      return { pinned, from: 0, to: 0, reopened: 0 };
    }
    throw error;
  }
}
