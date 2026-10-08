/**
 * La ruta del programa de un estudiante.
 * SSOT: plan/08-aprender-y-evaluar.md:12-19 (§1), reference/01-routing/routes.md:27,
 * reference/02-api/endpoints.md:36.
 *
 * Trae los datos; quien decide qué está habilitado es `outline.ts`, que es puro.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { COVER_URL_SECONDS, createReadUrls } from '@/lib/media/storage';
import { bogotaDate } from '@colombia-estudia/domain';
import {
  assessmentStatus,
  sequence,
  moduleAccess,
  resumePoint,
  nextPoint,
  progressOf,
  type ModuleAccess,
  type OutlineItem,
  type SequencedItem,
} from './outline';

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
  /** De qué va el componente (25/9); nulo si el equipo no lo escribió. */
  description: string | null;
  /**
   * La imagen de la tarjeta del componente (27/9), firmada (10 min). Desde el 3/10 se firman
   * todas en una sola llamada a Storage (`createReadUrls`): la ruta enseña la portada de cada
   * componente, en gris los bloqueados.
   */
  coverUrl: string | null;
  /** Si el componente está abierto para esta matrícula (3/10): ver `moduleAccess`. */
  access: ModuleAccess;
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
    /** Programa gratuito (25/9): se dice en la pantalla, porque es lo que promociona la institución. */
    programFree: boolean;
    progression: 'LINEAR' | 'FREE';
    startsOn: string;
    endsOn: string;
    accessUntil: string;
  } | null;
  modules: OutlineModule[];
  resume: SequencedItem | null;
  /** El primer ítem sin completar, se pueda abrir o no (23/9): para explicar la espera. */
  upcoming: SequencedItem | null;
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
  upcoming: null,
  progress: { completed: 0, total: 0 },
  partnerFunded: false,
};

/**
 * Qué matrícula pinta la ruta (21/9). Un estudiante puede estar en varias cohortes a la vez
 * —el de introducción y el de bachillerato, o dos programas—, así que «mi cohorte» no es
 * una sola:
 *
 * - `enrollmentId`: esa, siempre que sea de la persona. Lo usa el panel al elegir un programa.
 * - `assignmentId`: la matrícula de la cohorte que tiene esa asignación. Lo usan el player,
 *   la evidencia, la entrega y los intentos: un enlace a un tema tiene que abrir ese tema
 *   esté en la cohorte que esté, no el de «la más reciente».
 * - Nada: la más reciente, que es lo que había.
 */
export interface EnrollmentPick {
  enrollmentId?: string | null;
  assignmentId?: string | null;
}

export async function getCohortOutline({
  institutionId,
  personId,
  enrollmentId: pickedEnrollmentId = null,
  assignmentId: pickedAssignmentId = null,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
} & EnrollmentPick): Promise<CohortOutline> {
  const db = createTenantClient(institutionId);

  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId: personId,
      ...(pickedEnrollmentId ? { id: pickedEnrollmentId } : {}),
      ...(pickedAssignmentId
        ? {
            cohort: {
              OR: [
                { lessonAssignments: { some: { id: pickedAssignmentId } } },
                { assessmentAssignments: { some: { id: pickedAssignmentId } } },
              ],
            },
          }
        : {}),
    },
    orderBy: { enrolledAt: 'desc' },
    select: {
      id: true,
      status: true,
      accessUntil: true,
      startsAtModule: true,
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
          program: { select: { name: true, pricing: true } },
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
    programFree: cohort.program.pricing === 'FREE',
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

  // Grado de entrada (20/9): quien entra a un módulo posterior no ve los anteriores, y no
  // cuentan en su avance. `openCohort` los asigna igual; la matrícula es la que decide.
  const fromModule = enrollment.startsAtModule ?? 1;

  const [modules, unlocks, accommodation, lessonAssignments, assessmentAssignments] =
    await Promise.all([
      db.module.findMany({
        where: { programId: cohort.programId, archivedAt: null, position: { gte: fromModule } },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          description: true,
          coverMedia: { select: { providerRef: true, status: true } },
        },
      }),
      db.enrollmentModule.findMany({
        where: { enrollmentId: enrollment.id },
        select: { moduleId: true, availableFrom: true, availableUntil: true },
      }),
      // Intentos extra del PIAR: cuentan para saber si ya no le quedan (8/10).
      db.accommodation.findUnique({
        where: { enrollmentId: enrollment.id },
        select: { allowedAttemptsBonus: true },
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
              subject: { select: { id: true, name: true } },
            },
          },
          // Los minutos y si embebe vídeo: la forma del ítem en la ruta (misma regla que
          // `lesson-form.ts`: entrega > vídeo > lectura).
          lessonVersion: {
            select: {
              estimatedMinutes: true,
              assets: { select: { mediaAsset: { select: { kind: true } } } },
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
          assessment: {
            select: {
              id: true,
              title: true,
              moduleId: true,
              lessonId: true,
              position: true,
              subject: { select: { id: true, name: true } },
            },
          },
          assessmentVersion: {
            select: { timeLimitMinutes: true, maxAttempts: true, passPercent: true },
          },
          attempts: {
            where: { enrollmentId: enrollment.id },
            select: { status: true, score: true, maxScore: true },
          },
        },
      }),
    ]);

  const attemptsBonus = accommodation?.allowedAttemptsBonus ?? 0;

  const items: OutlineItem[] = [
    ...lessonAssignments.map((assignment): OutlineItem => {
      const progress = assignment.progress[0];
      return {
        kind: 'LESSON',
        assignmentId: assignment.id,
        title: assignment.lesson.title,
        moduleId: assignment.lesson.moduleId,
        lessonId: assignment.lesson.id,
        subjectId: assignment.lesson.subject.id,
        subjectName: assignment.lesson.subject.name,
        position: assignment.lesson.position,
        status:
          progress?.status === 'COMPLETED'
            ? 'COMPLETED'
            : progress?.status === 'IN_PROGRESS'
              ? 'IN_PROGRESS'
              : 'NOT_STARTED',
        requiresSubmission: assignment.lesson.requiresSubmission,
        form: assignment.lesson.requiresSubmission
          ? 'SUBMISSION'
          : assignment.lessonVersion.assets.some((a) => a.mediaAsset.kind === 'VIDEO')
            ? 'VIDEO'
            : 'MARKDOWN',
        estimatedMinutes: assignment.lessonVersion.estimatedMinutes,
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
          lessonId: assignment.assessment.lessonId,
          subjectId: assignment.assessment.subject?.id ?? null,
          subjectName: assignment.assessment.subject?.name ?? null,
          position: assignment.assessment.position,
          status: assessmentStatus(assignment.attempts, {
            attemptsAllowed: assignment.assessmentVersion.maxAttempts + attemptsBonus,
            passPercent: assignment.assessmentVersion.passPercent,
          }),
          form: 'ASSESSMENT',
          estimatedMinutes: assignment.assessmentVersion.timeLimitMinutes,
          dueAt: assignment.dueAt,
          availableFrom: assignment.availableFrom,
          // `dueAt` es la fecha de entrega, no el cierre del acceso: una evaluación vencida
          // se sigue viendo, y quien decide si admite un intento es el motor de intentos.
          availableUntil: null,
        },
      ];
    }),
  ];

  // Qué componente está habilitado para esta matrícula (3/10): el primero de su ruta, y los
  // que operación haya abierto a mano.
  const unlockOf = new Map(unlocks.map((row) => [row.moduleId, row]));
  const accessOf = new Map(
    modules.map((module, index) => [
      module.id,
      moduleAccess({
        first: index === 0,
        unlock: unlockOf.get(module.id) ?? null,
        progression: cohortInfo.progression,
        now,
      }),
    ])
  );

  const byModule = modules.map((module) => ({
    id: module.id,
    items: items.filter((item) => item.moduleId === module.id),
    access: accessOf.get(module.id) ?? { state: 'OPEN' as const },
  }));

  const sequenced = sequence({
    modules: byModule,
    progression: cohortInfo.progression,
    now,
  });

  const all = [...sequenced.values()];
  const resume = resumePoint(all);

  // Las portadas listas, firmadas de una vez.
  const coverPaths = modules.flatMap((module) =>
    module.coverMedia?.status === 'READY' ? [module.coverMedia.providerRef] : []
  );
  const signed = await createReadUrls(coverPaths, COVER_URL_SECONDS);
  const coverUrls = new Map(coverPaths.map((path, index) => [path, signed[index] ?? null]));

  return {
    gate: null,
    enrollmentId: enrollment.id,
    cohort: cohortInfo,
    modules: modules.map((module) => ({
      id: module.id,
      name: module.name,
      position: module.position,
      description: module.description,
      coverUrl:
        module.coverMedia?.status === 'READY'
          ? (coverUrls.get(module.coverMedia.providerRef) ?? null)
          : null,
      access: accessOf.get(module.id) ?? { state: 'OPEN' as const },
      items: all.filter((item) => item.moduleId === module.id),
    })),
    resume,
    upcoming: nextPoint(all),
    progress: progressOf(all),
    partnerFunded,
  };
}

/** Una matrícula en el panel del estudiante: lo justo para elegir y para retomar. */
export interface MyEnrollment {
  enrollmentId: string;
  cohort: NonNullable<CohortOutline['cohort']>;
  gate: CohortGate | null;
  progress: { completed: number; total: number };
  resume: SequencedItem | null;
  upcoming: SequencedItem | null;
  partnerFunded: boolean;
}

/**
 * Todas las matrículas de la persona, para el panel (21/9). Las activas primero —lo que se
 * puede estudiar hoy va arriba— y dentro de cada grupo la más reciente antes.
 *
 * Una consulta de ruta por matrícula: son pocas (dos o tres por persona) y así el avance y el
 * «retomar» de cada tarjeta salen de la misma regla que la ruta entera, sin una segunda
 * aritmética que pueda discrepar.
 */
export async function listMyEnrollments({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<MyEnrollment[]> {
  const db = createTenantClient(institutionId);

  const enrollments = await db.enrollment.findMany({
    where: { studentId: personId },
    orderBy: { enrolledAt: 'desc' },
    select: { id: true },
  });

  const outlines = await Promise.all(
    enrollments.map((e) => getCohortOutline({ institutionId, personId, enrollmentId: e.id, now }))
  );

  const rows = outlines.flatMap((outline): MyEnrollment[] =>
    outline.enrollmentId && outline.cohort
      ? [
          {
            enrollmentId: outline.enrollmentId,
            cohort: outline.cohort,
            gate: outline.gate,
            progress: outline.progress,
            resume: outline.resume,
            upcoming: outline.upcoming,
            partnerFunded: outline.partnerFunded,
          },
        ]
      : []
  );

  const rank = (row: MyEnrollment) => (row.gate === null ? 0 : 1);
  return rows.sort((a, b) => rank(a) - rank(b));
}
