/**
 * La «preparación» de una pieza de contenido (23/9, tercera pieza de la revisión UX): lo que
 * el editor de un tema o de un examen enseña arriba para que quien escribe sepa dónde está
 * la pieza en la ruta, qué le falta y a quién le llegará cuando la publique.
 * SSOT: PRODUCT_DECISIONS.md 2026-09-23 («el administrador construye la misma ruta que
 * recorre el estudiante»), reference/01-routing/routes.md (`/contenido/temas/[lessonId]`,
 * `/contenido/examenes/[assessmentId]`).
 *
 * No repite lo que el editor ya sabe (el texto, los avisos, los vídeos: eso vive en el
 * cliente y cambia mientras se escribe). Trae lo que solo la base sabe: el sitio en la ruta,
 * los exámenes colgados del tema, la versión publicada y las cohortes abiertas del programa,
 * separadas en las que ya tienen la pieza y las que podrían recibirla desde
 * «Actualizaciones del programa» (`cohorts.service.ts#listPendingContentUpdates`).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';

export interface ReadinessCohorts {
  /** Cohortes abiertas que ya tienen la pieza asignada. */
  assigned: number;
  /** Cohortes abiertas del programa que aún no la tienen: al publicar, podrán añadirla. */
  pending: Array<{ id: string; code: string; name: string }>;
}

export interface LessonReadiness {
  program: { id: string; name: string };
  module: { id: string; name: string; position: number };
  /** El tema justo anterior en el módulo, para decir «después de …». */
  previousTitle: string | null;
  /**
   * El sitio del tema en la ruta del programa y sus vecinos, para el navegador de la
   * cabecera (24/9): la ruta entera, componente a componente, no solo el módulo.
   */
  route: LessonRouteNeighbors;
  /** Los exámenes colgados de este tema, en orden. */
  exams: Array<{ id: string; title: string; hasPublished: boolean }>;
  /** La versión publicada más alta, si la hay, con quién la publicó y cuándo. */
  published: PublishedVersion | null;
  cohorts: ReadinessCohorts;
}

export interface LessonRouteNeighbors {
  /** Posición 1-based del tema en la ruta del programa, contando solo los no archivados. */
  index: number;
  total: number;
  previous: { id: string; title: string } | null;
  next: { id: string; title: string } | null;
}

/**
 * Auditoría contextual (ola 2, 23/9): «Publicado por X el …» en la cabecera del editor, en
 * vez de un registro aparte que nadie abre. `by` es nulo si la persona ya no está o si la
 * versión se publicó sin actor (importaciones).
 */
export interface PublishedVersion {
  number: number;
  /** ISO 8601. */
  at: string | null;
  by: string | null;
}

export interface AssessmentReadiness {
  program: { id: string; name: string };
  module: { id: string; name: string; position: number } | null;
  /** El tema del que es examen; nulo si es de módulo o de programa. */
  lesson: { id: string; title: string } | null;
  published: PublishedVersion | null;
  cohorts: ReadinessCohorts;
}

async function publishedVersion(
  db: ReturnType<typeof createTenantClient>,
  version: { number: number; publishedAt: Date | null; publishedById: string | null } | undefined
): Promise<PublishedVersion | null> {
  if (!version) return null;
  const actor = version.publishedById
    ? await db.person.findUnique({
        where: { id: version.publishedById },
        select: { givenName: true, familyName: true },
      })
    : null;
  return {
    number: version.number,
    at: version.publishedAt?.toISOString() ?? null,
    by: actor ? `${actor.givenName} ${actor.familyName}` : null,
  };
}

export async function getLessonReadiness({
  institutionId,
  lessonId,
}: {
  institutionId: string;
  lessonId: string;
}): Promise<LessonReadiness | null> {
  const db = createTenantClient(institutionId);

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, archivedAt: null },
    select: {
      id: true,
      position: true,
      program: { select: { id: true, name: true } },
      module: { select: { id: true, name: true, position: true } },
      assessments: {
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          versions: { where: { status: 'PUBLISHED' }, take: 1, select: { id: true } },
        },
      },
      versions: {
        where: { status: 'PUBLISHED' },
        orderBy: { number: 'desc' },
        take: 1,
        select: { number: true, publishedAt: true, publishedById: true },
      },
    },
  });

  if (!lesson) return null;

  const [route, cohorts, published] = await Promise.all([
    // La ruta del programa en el orden en que la recorre el estudiante (componente, tema):
    // de aquí salen «después de …» (dentro del componente) y los vecinos del navegador.
    db.lesson.findMany({
      where: { programId: lesson.program.id, archivedAt: null },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true, title: true, moduleId: true },
    }),
    db.cohort.findMany({
      where: { programId: lesson.program.id, status: 'OPEN' },
      orderBy: { startsOn: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        lessonAssignments: { where: { lessonId: lesson.id }, select: { id: true } },
      },
    }),
    publishedVersion(db, lesson.versions[0]),
  ]);

  const index = route.findIndex((item) => item.id === lesson.id);
  const previous =
    index > 0 && route[index - 1]?.moduleId === lesson.module.id ? route[index - 1] : null;
  const pick = (item: { id: string; title: string } | undefined) =>
    item ? { id: item.id, title: item.title } : null;

  return {
    program: lesson.program,
    module: { id: lesson.module.id, name: lesson.module.name, position: lesson.module.position },
    previousTitle: previous?.title ?? null,
    route: {
      index: index + 1,
      total: route.length,
      previous: index > 0 ? pick(route[index - 1]) : null,
      next: index >= 0 ? pick(route[index + 1]) : null,
    },
    exams: lesson.assessments.map((exam) => ({
      id: exam.id,
      title: exam.title,
      hasPublished: exam.versions.length > 0,
    })),
    published,
    cohorts: splitCohorts(cohorts.map((c) => ({ ...c, has: c.lessonAssignments.length > 0 }))),
  };
}

export async function getAssessmentReadiness({
  institutionId,
  assessmentId,
}: {
  institutionId: string;
  assessmentId: string;
}): Promise<AssessmentReadiness | null> {
  const db = createTenantClient(institutionId);

  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, archivedAt: null },
    select: {
      id: true,
      program: { select: { id: true, name: true } },
      module: { select: { id: true, name: true, position: true } },
      lesson: { select: { id: true, title: true } },
      versions: {
        where: { status: 'PUBLISHED' },
        orderBy: { number: 'desc' },
        take: 1,
        select: { number: true, publishedAt: true, publishedById: true },
      },
    },
  });

  if (!assessment) return null;

  const [cohorts, published] = await Promise.all([
    db.cohort.findMany({
      where: { programId: assessment.program.id, status: 'OPEN' },
      orderBy: { startsOn: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        assessmentAssignments: { where: { assessmentId: assessment.id }, select: { id: true } },
      },
    }),
    publishedVersion(db, assessment.versions[0]),
  ]);

  return {
    program: assessment.program,
    module: assessment.module,
    lesson: assessment.lesson,
    published,
    cohorts: splitCohorts(cohorts.map((c) => ({ ...c, has: c.assessmentAssignments.length > 0 }))),
  };
}

function splitCohorts(
  cohorts: Array<{ id: string; code: string; name: string; has: boolean }>
): ReadinessCohorts {
  return {
    assigned: cohorts.filter((c) => c.has).length,
    pending: cohorts.filter((c) => !c.has).map(({ id, code, name }) => ({ id, code, name })),
  };
}
