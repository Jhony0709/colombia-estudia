/**
 * El constructor del programa (23/9): la ruta tal y como la recorrerá el estudiante, vista
 * por quien la escribe.
 * SSOT: reference/01-routing/routes.md (`/contenido/programas/[programId]`), decisión del 23/9
 * («el administrador construye exactamente la misma ruta que recorrerá el estudiante»).
 *
 * Trae módulos, temas y exámenes del programa y los ordena con **la misma función** que la
 * ruta del estudiante (`features/learn/server/outline.ts#sortItems`): cada tema seguido de
 * sus exámenes, los exámenes de módulo al final. Sin cohorte y sin fechas: aquí no hay
 * asignaciones, hay contenido; lo que cambia por ítem es su estado de publicación.
 */

import 'server-only';

import { isVersionLive, toPublishStatus, type PublishStatus } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { sortItems } from '@/features/learn/server/outline';

export type BuilderForm = 'VIDEO' | 'MARKDOWN' | 'SUBMISSION' | 'ASSESSMENT';

export interface BuilderItem {
  kind: 'LESSON' | 'ASSESSMENT';
  /** Id del tema o del examen, lo que la API necesita. */
  id: string;
  /** Código legible (`TEM-0001` / `EXA-0001`, 25/9): lo que lleva la URL del editor. */
  code: string;
  title: string;
  moduleId: string;
  /** El suyo en un tema; el del tema del que es examen en una evaluación. */
  lessonId: string | null;
  position: number;
  form: BuilderForm;
  /** Minutos estimados (tema, de su última versión) o límite del intento (examen). */
  estimatedMinutes: number | null;
  /** Solo temas. */
  subjectId: string | null;
  subjectName: string | null;
  /** Solo exámenes. */
  questionCount: number | null;
  assessmentKind: 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL' | null;
  /** Estado de la versión más alta; `null` si no tiene ninguna. */
  latestStatus: PublishStatus | null;
  latestNumber: number | null;
  /** Tiene alguna versión publicada: es lo que una cohorte al abrirse se lleva. */
  hasPublished: boolean;
}

export interface BuilderModule {
  id: string;
  name: string;
  position: number;
  items: BuilderItem[];
  /** Cuántos ítems tienen versión publicada, sobre cuántos hay. */
  readiness: { published: number; total: number };
}

export interface ProgramBuilder {
  program: { id: string; code: string; name: string; description: string | null };
  modules: BuilderModule[];
  /** Exámenes del programa sin módulo (diagnósticos): no van en la ruta, se listan aparte. */
  programAssessments: BuilderItem[];
  readiness: { published: number; total: number };
  /** Para el alta de temas desde aquí. */
  subjects: Array<{ id: string; name: string }>;
}

export async function getProgramBuilder({
  institutionId,
  programId,
}: {
  institutionId: string;
  programId: string;
}): Promise<ProgramBuilder | null> {
  const db = createTenantClient(institutionId);

  const program = await db.program.findFirst({
    where: { id: programId, archivedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      modules: {
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, position: true },
      },
    },
  });
  if (!program) return null;

  const [lessons, assessments, subjects] = await Promise.all([
    db.lesson.findMany({
      where: { programId, archivedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        moduleId: true,
        position: true,
        requiresSubmission: true,
        subject: { select: { id: true, name: true } },
        versions: {
          orderBy: { number: 'desc' },
          select: {
            number: true,
            status: true,
            estimatedMinutes: true,
            assets: { select: { mediaAsset: { select: { kind: true } } } },
          },
        },
      },
    }),
    db.assessment.findMany({
      where: { programId, archivedAt: null },
      select: {
        id: true,
        code: true,
        title: true,
        moduleId: true,
        lessonId: true,
        position: true,
        kind: true,
        versions: {
          orderBy: { number: 'desc' },
          select: { number: true, status: true, content: true, timeLimitMinutes: true },
        },
      },
    }),
    db.subject.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const lessonItems: BuilderItem[] = lessons.map((lesson) => {
    const latest = lesson.versions[0];
    // La forma y los minutos se leen de la versión publicada si la hay —es la que ve el
    // estudiante— y del borrador solo cuando no hay otra. Misma regla que `lesson-form.ts`:
    // entrega > vídeo > lectura.
    const live = lesson.versions.find((v) => isVersionLive(toPublishStatus(v.status))) ?? latest;
    const hasVideo = live?.assets.some((a) => a.mediaAsset.kind === 'VIDEO') ?? false;
    return {
      kind: 'LESSON',
      id: lesson.id,
      code: lesson.code,
      title: lesson.title,
      moduleId: lesson.moduleId,
      lessonId: lesson.id,
      position: lesson.position,
      form: lesson.requiresSubmission ? 'SUBMISSION' : hasVideo ? 'VIDEO' : 'MARKDOWN',
      estimatedMinutes: live?.estimatedMinutes ?? null,
      subjectId: lesson.subject.id,
      subjectName: lesson.subject.name,
      questionCount: null,
      assessmentKind: null,
      latestStatus: latest ? toPublishStatus(latest.status) : null,
      latestNumber: latest?.number ?? null,
      hasPublished: lesson.versions.some((v) => isVersionLive(toPublishStatus(v.status))),
    };
  });

  const assessmentItems: BuilderItem[] = assessments.map((assessment) => {
    const latest = assessment.versions[0];
    return {
      kind: 'ASSESSMENT',
      id: assessment.id,
      code: assessment.code,
      title: assessment.title,
      moduleId: assessment.moduleId ?? '',
      lessonId: assessment.lessonId,
      position: assessment.position,
      form: 'ASSESSMENT',
      estimatedMinutes: latest?.timeLimitMinutes ?? null,
      subjectId: null,
      subjectName: null,
      questionCount: countQuestions(latest?.content),
      assessmentKind: assessment.kind as BuilderItem['assessmentKind'],
      latestStatus: latest ? toPublishStatus(latest.status) : null,
      latestNumber: latest?.number ?? null,
      hasPublished: assessment.versions.some((v) => isVersionLive(toPublishStatus(v.status))),
    };
  });

  const all = [...lessonItems, ...assessmentItems];
  const readinessOf = (items: BuilderItem[]) => ({
    published: items.filter((item) => item.hasPublished).length,
    total: items.length,
  });

  const modules: BuilderModule[] = program.modules.map((module) => {
    const items = sortItems(all.filter((item) => item.moduleId === module.id));
    return {
      id: module.id,
      name: module.name,
      position: module.position,
      items,
      readiness: readinessOf(items),
    };
  });

  const programAssessments = assessmentItems
    .filter((item) => item.moduleId === '')
    .sort((a, b) => a.position - b.position);

  return {
    program: {
      id: program.id,
      code: program.code,
      name: program.name,
      description: program.description,
    },
    modules,
    programAssessments,
    readiness: readinessOf(all),
    subjects,
  };
}

function countQuestions(content: unknown): number {
  if (typeof content !== 'object' || content === null) return 0;
  const questions = (content as { questions?: unknown }).questions;
  return Array.isArray(questions) ? questions.length : 0;
}
