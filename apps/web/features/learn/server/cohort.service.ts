/**
 * La ruta del programa de un estudiante.
 * SSOT: plan/08-aprender-y-evaluar.md:12-19 (§1), reference/01-routing/routes.md:27,
 * reference/02-api/endpoints.md:36.
 *
 * Trae los datos; quien decide qué está habilitado es `outline.ts`, que es puro.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { bogotaDate } from '@colombia-estudia/domain';
import { sequence, resumePoint, progressOf, type OutlineItem, type SequencedItem } from './outline';

/**
 * Por qué el estudiante no puede estudiar ahora mismo.
 * Los estados terminales de `routes.md:27`, cada uno con su mensaje propio.
 */
export type CohortGate =
  | { kind: 'NO_ENROLLMENT' }
  | { kind: 'NOT_STARTED_YET'; startsOn: string }
  /**
   * La cohorte existe, la fecha de inicio ya llegó, pero nadie la ha abierto todavía.
   *
   * Separado de `NOT_STARTED_YET` porque son cosas distintas y confundirlas le miente al
   * estudiante: `PLANNED` no significa «todavía no llega la fecha», significa «operación no
   * la ha abierto». Con la fecha de inicio ya pasada, decir «inicia el 18/9» un 18/9 —o peor,
   * un 20/9— manda a alguien a esperar un día que ya llegó.
   */
  | { kind: 'NOT_OPEN_YET' }
  | { kind: 'ACCESS_EXPIRED'; accessUntil: string }
  | { kind: 'COMPLETED' }
  | { kind: 'WITHDRAWN' };

export interface OutlineModule {
  id: string;
  name: string;
  position: number;
  items: SequencedItem[];
}

export interface CohortOutline {
  gate: CohortGate | null;
  /**
   * La matrícula del propio estudiante que pregunta. El player la necesita para leer su
   * progreso y su entrega. Va aquí y no en una segunda consulta porque este endpoint solo
   * contesta sobre quien lo llama; y que viaje al cliente no abre nada: ninguna ruta acepta
   * un `enrollmentId` del cuerpo, siempre sale del contexto de la petición.
   */
  enrollmentId: string | null;
  cohort: {
    id: string;
    code: string;
    name: string;
    programName: string;
    progression: 'LINEAR' | 'FREE';
    startsOn: string;
    endsOn: string;
    accessUntil: string;
  } | null;
  modules: OutlineModule[];
  resume: SequencedItem | null;
  progress: { completed: number; total: number };
  /** Decisión 8: se dice que la financia una entidad aliada, sin nombrarla. */
  partnerFunded: boolean;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const EMPTY: CohortOutline = {
  gate: { kind: 'NO_ENROLLMENT' },
  enrollmentId: null,
  cohort: null,
  modules: [],
  resume: null,
  progress: { completed: 0, total: 0 },
  partnerFunded: false,
};

/**
 * El estado de una evaluación, a partir de sus intentos.
 *
 * Un intento calificado la da por hecha aunque la nota sea baja: aprobar o no es otra
 * pregunta, y mezclarlas haría que un estudiante no pudiera avanzar por haber sacado 2,8.
 */
function assessmentStatus(attempts: Array<{ status: string }>): OutlineItem['status'] {
  if (attempts.some((attempt) => attempt.status === 'GRADED')) return 'COMPLETED';
  if (attempts.some((attempt) => attempt.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (attempts.length > 0) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export async function getCohortOutline({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<CohortOutline> {
  const db = createTenantClient(institutionId);

  // La matrícula más reciente: el plan habla de "mi cohorte" en singular, y con varias la
  // que importa es en la que está ahora.
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: personId },
    orderBy: { enrolledAt: 'desc' },
    select: {
      id: true,
      status: true,
      accessUntil: true,
      cohort: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          progression: true,
          startsOn: true,
          endsOn: true,
          partnerId: true,
          programId: true,
          program: { select: { name: true } },
        },
      },
      paymentPlan: { select: { payerType: true } },
    },
  });

  if (!enrollment) return EMPTY;

  const { cohort } = enrollment;
  const today = new Date(bogotaDate(now));

  const cohortInfo = {
    id: cohort.id,
    code: cohort.code,
    name: cohort.name,
    programName: cohort.program.name,
    progression: cohort.progression === 'FREE' ? ('FREE' as const) : ('LINEAR' as const),
    startsOn: isoDay(cohort.startsOn),
    endsOn: isoDay(cohort.endsOn),
    accessUntil: isoDay(enrollment.accessUntil),
  };

  const partnerFunded = enrollment.paymentPlan?.payerType === 'PARTNER';

  // Los estados terminales van antes que los datos: si el acceso venció, cargar la ruta
  // entera es trabajo para una pantalla que no la va a enseñar.
  const gate = ((): CohortGate | null => {
    if (enrollment.status === 'WITHDRAWN') return { kind: 'WITHDRAWN' };
    if (enrollment.status === 'COMPLETED') return { kind: 'COMPLETED' };
    if (enrollment.accessUntil < today) {
      return { kind: 'ACCESS_EXPIRED', accessUntil: cohortInfo.accessUntil };
    }
    if (cohort.status === 'PLANNED') {
      return cohort.startsOn > today
        ? { kind: 'NOT_STARTED_YET', startsOn: cohortInfo.startsOn }
        : { kind: 'NOT_OPEN_YET' };
    }
    return null;
  })();

  if (gate) {
    return { ...EMPTY, gate, enrollmentId: enrollment.id, cohort: cohortInfo, partnerFunded };
  }

  const [modules, lessonAssignments, assessmentAssignments] = await Promise.all([
    db.module.findMany({
      where: { programId: cohort.programId, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, position: true },
    }),
    db.lessonAssignment.findMany({
      where: { cohortId: cohort.id },
      select: {
        id: true,
        availableFrom: true,
        availableUntil: true,
        lesson: {
          select: {
            id: true,
            title: true,
            moduleId: true,
            position: true,
            requiresSubmission: true,
          },
        },
        progress: {
          where: { enrollmentId: enrollment.id },
          select: { status: true },
        },
      },
    }),
    db.assessmentAssignment.findMany({
      where: { cohortId: cohort.id },
      select: {
        id: true,
        availableFrom: true,
        dueAt: true,
        assessment: { select: { id: true, title: true, moduleId: true, position: true } },
        attempts: { where: { studentId: personId }, select: { status: true } },
      },
    }),
  ]);

  const items: OutlineItem[] = [
    ...lessonAssignments.map((assignment): OutlineItem => {
      const progress = assignment.progress[0];
      return {
        kind: 'LESSON',
        assignmentId: assignment.id,
        title: assignment.lesson.title,
        moduleId: assignment.lesson.moduleId,
        position: assignment.lesson.position,
        status:
          progress?.status === 'COMPLETED'
            ? 'COMPLETED'
            : progress?.status === 'IN_PROGRESS'
              ? 'IN_PROGRESS'
              : 'NOT_STARTED',
        requiresSubmission: assignment.lesson.requiresSubmission,
        availableFrom: assignment.availableFrom,
        availableUntil: assignment.availableUntil,
      };
    }),
    ...assessmentAssignments.flatMap((assignment): OutlineItem[] => {
      // Una evaluación sin módulo (la diagnóstica) no cabe en el acordeón de módulos.
      // Se deja fuera de la secuencia en vez de inventarle un sitio.
      if (!assignment.assessment.moduleId) return [];

      return [
        {
          kind: 'ASSESSMENT',
          assignmentId: assignment.id,
          title: assignment.assessment.title,
          moduleId: assignment.assessment.moduleId,
          position: assignment.assessment.position,
          status: assessmentStatus(assignment.attempts),
          availableFrom: assignment.availableFrom,
          // `dueAt` es la fecha de entrega, no el cierre del acceso: una evaluación vencida
          // se sigue viendo, y quien decide si admite un intento es el motor de intentos.
          availableUntil: null,
        },
      ];
    }),
  ];

  const byModule = modules.map((module) => ({
    id: module.id,
    items: items.filter((item) => item.moduleId === module.id),
  }));

  const sequenced = sequence({
    modules: byModule,
    progression: cohortInfo.progression,
    now,
  });

  const all = [...sequenced.values()];

  return {
    gate: null,
    enrollmentId: enrollment.id,
    cohort: cohortInfo,
    modules: modules.map((module) => ({
      id: module.id,
      name: module.name,
      position: module.position,
      items: all.filter((item) => item.moduleId === module.id),
    })),
    resume: resumePoint(all),
    progress: progressOf(all),
    partnerFunded,
  };
}
