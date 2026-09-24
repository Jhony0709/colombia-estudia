/**
 * Evaluaciones: editar el borrador, la clave de respuestas y publicar.
 * SSOT: plan/07-contenido-y-migracion.md:40-44 (§4), reference/02-api/endpoints.md:57.
 *
 * La regla que manda aquí es una sola y es de seguridad: **`content` y `answerKey` nunca
 * viajan en el mismo objeto**. El plan lo dice del editor ("panel aparte, visualmente
 * separado y nunca en el mismo objeto") y aquí se lleva hasta el transporte: son dos
 * funciones, dos endpoints y dos respuestas. Una respuesta que lleve las dos cosas es una
 * respuesta que algún día se cachea, se registra en un log o se pinta entera en el HTML de
 * una página de estudiante.
 *
 * `answerKey` solo se lee desde tres sitios: este servicio (para que el autor la edite),
 * la validación de publicación y `grading.ts`. Ningún camino de estudiante lo toca.
 */

import 'server-only';

import {
  isVersionEditable,
  isVersionLive,
  canTransition,
  toPublishStatus,
  validateAssessmentForPublish,
  type PublishStatus,
  type ValidationResult,
} from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

export interface AssessmentListItem {
  id: string;
  title: string;
  kind: string;
  position: number;
  moduleName: string | null;
  /** Título del tema del que es examen (20/9); nulo si es del módulo o del programa. */
  lessonTitle: string | null;
  latestStatus: PublishStatus | null;
  latestNumber: number | null;
  hasPublished: boolean;
  questionCount: number;
}

/** El borrador tal y como lo ve el editor. **Sin la clave de respuestas.** */
export interface AssessmentDraftView {
  assessmentId: string;
  title: string;
  kind: string;
  language: string;
  versionId: string;
  number: number;
  content: unknown;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  passPercent: number | null;
  reviewPolicy: string;
  /** Si alguna versión está publicada: la cabecera del editor lo dice junto al número. */
  hasPublished: boolean;
}

/** Cuántas preguntas tiene un `content` guardado, sin fiarse de su forma. */
function countQuestions(content: unknown): number {
  if (typeof content !== 'object' || content === null) return 0;
  const questions = (content as { questions?: unknown }).questions;
  return Array.isArray(questions) ? questions.length : 0;
}

/**
 * Crea una evaluación y le abre la versión 1 en borrador.
 *
 * Igual que con los temas: sin versión no hay nada que editar. La versión nace con
 * `questions: []` y la clave vacía, y así **no puede publicarse** hasta que tenga preguntas
 * — la regla `questions-required` del dominio.
 *
 * `moduleId` es opcional porque una evaluación diagnóstica es del programa y no de un
 * módulo. `@@unique([moduleId, position])` no estorba con varios nulos: Postgres trata los
 * NULL como distintos entre sí.
 */
export async function createAssessment({
  institutionId,
  actorId,
  programId,
  moduleId,
  lessonId,
  subjectId,
  kind,
  title,
  learningObjective,
}: {
  institutionId: string;
  actorId: string;
  programId: string;
  moduleId?: string | null;
  /** El tema del que es examen (20/9). Tiene que ser del mismo módulo. */
  lessonId?: string | null;
  subjectId?: string | null;
  kind: 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL';
  title: string;
  learningObjective?: string | null;
}): Promise<{ assessmentId: string; versionId: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const program = await tx.program.findFirst({
      where: { id: programId, archivedAt: null },
      select: { id: true },
    });
    if (!program) throw new APIError('Program not found', 'NOT_FOUND');

    if (moduleId) {
      const found = await tx.module.findFirst({
        where: { id: moduleId, programId, archivedAt: null },
        select: { id: true },
      });
      // El módulo tiene que ser DE ese programa: si no, la evaluación aparecería en un sitio
      // y contaría en otro.
      if (!found) throw new APIError('Module not found in this program', 'NOT_FOUND');
    }

    if (lessonId) {
      // Un examen de tema (20/9) va justo después de ese tema en la ruta del estudiante, y
      // eso solo tiene sentido si el tema es del mismo módulo. Sin módulo no hay tema posible.
      const lesson = moduleId
        ? await tx.lesson.findFirst({
            where: { id: lessonId, moduleId, archivedAt: null },
            select: { id: true },
          })
        : null;
      if (!lesson) throw new APIError('Lesson not found in this module', 'NOT_FOUND');
    }

    // `position` ordena las evaluaciones entre sí dentro del módulo; el sitio que ocupan
    // respecto a los temas lo decide `lessonId` (features/learn/server/outline.ts).
    const last = moduleId
      ? await tx.assessment.findFirst({
          where: { moduleId },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      : null;

    try {
      const assessment = await tx.assessment.create({
        data: {
          institutionId,
          programId,
          moduleId: moduleId ?? null,
          lessonId: lessonId ?? null,
          subjectId: subjectId ?? null,
          kind,
          position: (last?.position ?? 0) + 1,
          title,
          learningObjective: learningObjective === '' ? null : (learningObjective ?? null),
          authorId: actorId,
        },
        select: { id: true },
      });

      const version = await tx.assessmentVersion.create({
        data: {
          institutionId,
          assessmentId: assessment.id,
          number: 1,
          status: 'DRAFT',
          content: { questions: [] },
          answerKey: {},
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'assessment',
          entityId: assessment.id,
          action: 'created',
          after: { title, kind, moduleId: moduleId ?? null, lessonId: lessonId ?? null },
        },
      });

      return { assessmentId: assessment.id, versionId: version.id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new APIError(
          'Otro examen ocupó esa posición en el componente mientras se creaba este. Inténtalo otra vez.',
          'CONFLICT'
        );
      }
      throw error;
    }
  });
}

export async function listAssessments({
  institutionId,
}: {
  institutionId: string;
}): Promise<AssessmentListItem[]> {
  const db = createTenantClient(institutionId);

  const assessments = await db.assessment.findMany({
    where: { archivedAt: null },
    orderBy: [{ moduleId: 'asc' }, { position: 'asc' }],
    select: {
      id: true,
      title: true,
      kind: true,
      position: true,
      module: { select: { name: true } },
      lesson: { select: { title: true } },
      versions: {
        orderBy: { number: 'desc' },
        select: { number: true, status: true, content: true },
      },
    },
  });

  return assessments.map((assessment) => {
    const latest = assessment.versions[0];

    return {
      id: assessment.id,
      title: assessment.title,
      kind: assessment.kind,
      position: assessment.position,
      moduleName: assessment.module?.name ?? null,
      lessonTitle: assessment.lesson?.title ?? null,
      latestStatus: latest ? toPublishStatus(latest.status) : null,
      latestNumber: latest?.number ?? null,
      hasPublished: assessment.versions.some((v) => isVersionLive(toPublishStatus(v.status))),
      questionCount: countQuestions(latest?.content),
    };
  });
}

/**
 * Abre el borrador sobre el que se edita, creándolo si la versión más alta está publicada.
 *
 * Igual que en los temas: una versión publicada tiene intentos hechos contra ella, así que
 * cambiarla es cambiar el examen que alguien ya presentó.
 */
export async function openAssessmentDraft({
  institutionId,
  assessmentId,
}: {
  institutionId: string;
  assessmentId: string;
}): Promise<AssessmentDraftView> {
  const db = createTenantClient(institutionId);

  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, archivedAt: null },
    select: {
      id: true,
      title: true,
      kind: true,
      language: true,
      versions: {
        orderBy: { number: 'desc' },
        take: 1,
        select: {
          id: true,
          number: true,
          status: true,
          content: true,
          maxAttempts: true,
          timeLimitMinutes: true,
          passPercent: true,
          reviewPolicy: true,
        },
      },
    },
  });

  if (!assessment) throw new APIError('Assessment not found', 'NOT_FOUND');

  const latest = assessment.versions[0];
  const base = {
    assessmentId: assessment.id,
    title: assessment.title,
    kind: assessment.kind,
    language: assessment.language,
    hasPublished: assessment.versions.some((v) => isVersionLive(toPublishStatus(v.status))),
  };

  if (latest && isVersionEditable(toPublishStatus(latest.status))) {
    return {
      ...base,
      versionId: latest.id,
      number: latest.number,
      content: latest.content,
      maxAttempts: latest.maxAttempts,
      timeLimitMinutes: latest.timeLimitMinutes,
      passPercent: latest.passPercent,
      reviewPolicy: latest.reviewPolicy,
    };
  }

  // Al abrir la siguiente versión se copian las preguntas Y la clave: una evaluación sin
  // clave no es un borrador a medias, es una evaluación que no se puede calificar.
  const previous = latest
    ? await db.assessmentVersion.findFirst({
        where: { id: latest.id },
        select: { answerKey: true },
      })
    : null;

  const created = await db.assessmentVersion.create({
    data: {
      institutionId,
      assessmentId,
      number: (latest?.number ?? 0) + 1,
      status: 'DRAFT',
      content: latest?.content ?? { questions: [] },
      answerKey: previous?.answerKey ?? {},
      maxAttempts: latest?.maxAttempts ?? 1,
      timeLimitMinutes: latest?.timeLimitMinutes ?? null,
      passPercent: latest?.passPercent ?? null,
      reviewPolicy: latest?.reviewPolicy ?? 'SCORE_ONLY',
    },
    select: {
      id: true,
      number: true,
      content: true,
      maxAttempts: true,
      timeLimitMinutes: true,
      passPercent: true,
      reviewPolicy: true,
    },
  });

  return {
    ...base,
    versionId: created.id,
    number: created.number,
    content: created.content,
    maxAttempts: created.maxAttempts,
    timeLimitMinutes: created.timeLimitMinutes,
    passPercent: created.passPercent,
    reviewPolicy: created.reviewPolicy,
  };
}

async function requireDraft(institutionId: string, versionId: string) {
  const db = createTenantClient(institutionId);

  const version = await db.assessmentVersion.findFirst({
    where: { id: versionId },
    select: { id: true, status: true },
  });

  if (!version) throw new APIError('Assessment version not found', 'NOT_FOUND');
  if (!isVersionEditable(toPublishStatus(version.status))) {
    throw new APIError(
      'Esa versión ya está publicada y no se puede editar. Abre el examen otra vez para empezar la siguiente.',
      'CONFLICT'
    );
  }

  return version;
}

/** Guarda las preguntas y los ajustes del intento. **Nunca toca `answerKey`.** */
export async function saveAssessmentContent({
  institutionId,
  versionId,
  content,
  maxAttempts,
  timeLimitMinutes,
  passPercent,
  reviewPolicy,
}: {
  institutionId: string;
  versionId: string;
  content: unknown;
  maxAttempts?: number;
  timeLimitMinutes?: number | null;
  passPercent?: number | null;
  reviewPolicy?: string;
}): Promise<{ savedAt: string }> {
  await requireDraft(institutionId, versionId);
  const db = createTenantClient(institutionId);

  await db.assessmentVersion.update({
    where: { id: versionId },
    data: {
      content: content as never,
      ...(maxAttempts !== undefined ? { maxAttempts } : {}),
      ...(timeLimitMinutes !== undefined ? { timeLimitMinutes } : {}),
      ...(passPercent !== undefined ? { passPercent } : {}),
      ...(reviewPolicy !== undefined ? { reviewPolicy: reviewPolicy as never } : {}),
    },
  });

  return { savedAt: new Date().toISOString() };
}

/**
 * La clave de respuestas, sola.
 *
 * Su propia función y su propio endpoint: así ninguna respuesta del servidor lleva las
 * preguntas y las respuestas juntas, y el día que alguien cachee la respuesta del editor de
 * preguntas no estará cacheando el examen resuelto.
 */
export async function getAnswerKey({
  institutionId,
  versionId,
}: {
  institutionId: string;
  versionId: string;
}): Promise<{ answerKey: unknown }> {
  const db = createTenantClient(institutionId);

  const version = await db.assessmentVersion.findFirst({
    where: { id: versionId },
    select: { answerKey: true },
  });

  if (!version) throw new APIError('Assessment version not found', 'NOT_FOUND');

  return { answerKey: version.answerKey };
}

/** Guarda la clave. **Nunca toca `content`.** */
export async function saveAnswerKey({
  institutionId,
  versionId,
  answerKey,
}: {
  institutionId: string;
  versionId: string;
  answerKey: unknown;
}): Promise<{ savedAt: string }> {
  await requireDraft(institutionId, versionId);
  const db = createTenantClient(institutionId);

  await db.assessmentVersion.update({
    where: { id: versionId },
    data: { answerKey: answerKey as never },
  });

  return { savedAt: new Date().toISOString() };
}

/** Valida sin publicar: es el panel de avisos del editor de evaluaciones. */
export async function validateAssessmentDraft({
  institutionId,
  versionId,
}: {
  institutionId: string;
  versionId: string;
}): Promise<ValidationResult> {
  const db = createTenantClient(institutionId);

  const version = await db.assessmentVersion.findFirst({
    where: { id: versionId },
    select: { content: true, answerKey: true },
  });

  if (!version) throw new APIError('Assessment version not found', 'NOT_FOUND');

  return validateAssessmentForPublish({
    content: version.content,
    answerKey: version.answerKey,
  });
}

/**
 * Publica la evaluación.
 *
 * Sobre `answer-key-leak`, la regla del dominio: comprobado ejecutándola, lo que detecta es
 * **estructural** — que dentro de `content` aparezcan claves prohibidas como `answerKey` o
 * `correct`. Es decir, coge el caso de "se me coló el objeto de la clave dentro de las
 * preguntas", que es el que ocurre por un error de programación.
 *
 * Lo que **no** detecta es la fuga semántica: un enunciado que diga "la respuesta correcta
 * es la a)" pasa la validación. Eso no es un fallo de la regla —ninguna regla automática lee
 * español— pero conviene saberlo antes de confiar en que publicar garantiza que el examen no
 * se regala. Registrado en `docs/estado.md`.
 */
export async function publishAssessment({
  institutionId,
  actorId,
  versionId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  versionId: string;
  now?: Date;
}): Promise<{ versionId: string; number: number; publishedAt: string }> {
  const db = createTenantClient(institutionId);

  const version = await db.assessmentVersion.findFirst({
    where: { id: versionId },
    select: { id: true, assessmentId: true, number: true, status: true },
  });

  if (!version) throw new APIError('Assessment version not found', 'NOT_FOUND');
  if (!canTransition('publish', toPublishStatus(version.status)).allowed) {
    throw new APIError('Esta versión ya no es un borrador', 'CONFLICT');
  }

  const validation = await validateAssessmentDraft({ institutionId, versionId });
  if (!validation.ok) {
    throw new APIError(
      `La evaluación todavía tiene ${validation.errors.length} problema(s) que impiden publicarla.`,
      'INVALID_CONTENT',
      { errors: validation.errors }
    );
  }

  await db.$transaction(async (tx) => {
    await tx.assessmentVersion.update({
      where: { id: versionId },
      data: { status: 'PUBLISHED', publishedAt: now, publishedById: actorId },
    });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'assessment_version',
        entityId: versionId,
        action: 'published',
        // El resumen NO lleva ni preguntas ni respuestas: un AuditLog se lee en soporte.
        after: {
          assessmentId: version.assessmentId,
          number: version.number,
          warnings: validation.warnings.length,
        },
      },
    });
  });

  return { versionId, number: version.number, publishedAt: now.toISOString() };
}
