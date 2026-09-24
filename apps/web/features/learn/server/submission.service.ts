/**
 * La entrega de un tema con `requiresSubmission`, del lado del estudiante.
 * SSOT: plan/08-aprender-y-evaluar.md:42-44, reference/02-api/endpoints.md:41,
 * prisma/schema.prisma (`Submission`).
 *
 * «Una por tema; reenvío tras RETURNED»: hay una sola fila por (matrícula, asignación) y el
 * reenvío la vuelve a poner en `SUBMITTED` con el texto y el archivo nuevos. El comentario
 * de la devolución anterior se conserva hasta la siguiente revisión, para que el revisor vea
 * qué pidió. Lo que sí queda para siempre es el rastro: `LearningEvent` en cada envío y
 * `AuditLog` en cada revisión.
 *
 * Quién puede entregar lo decide la misma secuencia que pinta la ruta (`getCohortOutline`),
 * como la evidencia: un tema bloqueado no admite entregas.
 */

import 'server-only';

import { JSON_NULL, type JsonValue } from '@/lib/db/prisma';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { createReadUrl } from '@/lib/media/storage';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';
import { getCohortOutline } from './cohort.service';
import { promptsOf } from '@/features/content/server/lessons.service';

export type SubmissionState = 'SUBMITTED' | 'RETURNED' | 'APPROVED';

/** Una respuesta con su enunciado tal como se preguntó (24/9). */
export interface SubmissionAnswer {
  prompt: string;
  answer: string;
}

/** El JSON de la base como respuestas, tolerante con lo que no lo sea. */
export function answersOf(value: unknown): SubmissionAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is SubmissionAnswer =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as SubmissionAnswer).prompt === 'string' &&
      typeof (a as SubmissionAnswer).answer === 'string'
  );
}

export interface SubmissionView {
  id: string;
  status: SubmissionState;
  text: string | null;
  /** Respuestas por enunciado; vacío cuando la actividad era de un solo texto. */
  answers: SubmissionAnswer[];
  file: { name: string; url: string } | null;
  feedback: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

function fileNameOf(path: string): string {
  return path.split('/').pop() ?? 'archivo';
}

/** La entrega vigente del estudiante para un tema, con la URL firmada del archivo. */
export async function getSubmissionForStudent({
  institutionId,
  enrollmentId,
  assignmentId,
}: {
  institutionId: string;
  enrollmentId: string;
  assignmentId: string;
}): Promise<SubmissionView | null> {
  const db = createTenantClient(institutionId);
  const row = await db.submission.findFirst({
    where: { enrollmentId, lessonAssignmentId: assignmentId },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      status: true,
      text: true,
      answers: true,
      feedback: true,
      submittedAt: true,
      reviewedAt: true,
      file: { select: { providerRef: true, status: true } },
    },
  });
  if (!row) return null;
  const file =
    row.file && row.file.status === 'READY'
      ? { name: fileNameOf(row.file.providerRef), url: await createReadUrl(row.file.providerRef) }
      : null;
  return {
    id: row.id,
    status: row.status as SubmissionState,
    text: row.text,
    answers: answersOf(row.answers),
    file,
    feedback: row.feedback,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}

export async function submitLesson({
  institutionId,
  personId,
  assignmentId,
  text,
  answers,
  fileAssetId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  text: string | null;
  /** Respuestas en el orden de los enunciados del tema (24/9); `null` si no hay enunciados. */
  answers: string[] | null;
  fileAssetId: string | null;
  now?: Date;
}): Promise<SubmissionView> {
  if (!text && !answers?.length && !fileAssetId) {
    throw new APIError('La actividad necesita un texto o un archivo', 'VALIDATION_ERROR');
  }

  const outline = await getCohortOutline({ institutionId, personId, assignmentId, now });
  if (outline.gate || !outline.cohort || !outline.enrollmentId) {
    throw new APIError('No hay una cohorte en la que entregar', 'ACCESS_EXPIRED');
  }
  const enrollmentId = outline.enrollmentId;
  const item = outline.modules.flatMap((m) => m.items).find((i) => i.assignmentId === assignmentId);
  if (!item || item.kind !== 'LESSON') throw new APIError('Not found', 'NOT_FOUND');
  if (!item.enabled) throw new APIError('Este tema todavía no está habilitado', 'LESSON_LOCKED');

  const db = createTenantClient(institutionId);

  const assignment = await db.lessonAssignment.findFirst({
    where: { id: assignmentId, cohortId: outline.cohort.id },
    select: {
      lessonVersionId: true,
      lesson: {
        select: {
          id: true,
          title: true,
          requiresSubmission: true,
          activityAccepts: true,
          activityPrompts: true,
        },
      },
    },
  });
  if (!assignment) throw new APIError('Not found', 'NOT_FOUND');
  if (!assignment.lesson.requiresSubmission) {
    throw new APIError('Este tema no se completa con una actividad', 'CONFLICT');
  }

  // Lo que el autor dijo que se acepta (23/9): el formulario ya lo enseña, pero la regla
  // vive aquí. Un texto donde se pidió un archivo no es una entrega a medias, es otra cosa.
  const accepts = assignment.lesson.activityAccepts;
  const prompts = accepts === 'FILE' ? [] : promptsOf(assignment.lesson.activityPrompts);
  if (accepts === 'FILE' && !fileAssetId) {
    throw new APIError('Esta actividad se entrega con un archivo', 'VALIDATION_ERROR');
  }
  if (accepts === 'TEXT' && fileAssetId) {
    throw new APIError('Esta actividad no admite archivos', 'VALIDATION_ERROR');
  }
  // Con enunciados (24/9), lo escrito va pregunta por pregunta: todas respondidas, y el
  // enunciado se guarda junto a la respuesta para que la revisión vea lo que se preguntó.
  let answerRows: SubmissionAnswer[] | null = null;
  if (prompts.length > 0) {
    const given = (answers ?? []).map((a) => a.trim());
    if (given.length !== prompts.length || given.some((a) => a === '')) {
      throw new APIError('Responde todas las preguntas de la actividad', 'VALIDATION_ERROR');
    }
    answerRows = prompts.map((prompt, i) => ({ prompt, answer: given[i]! }));
    text = null;
  } else if (accepts === 'TEXT' && !text) {
    throw new APIError('Esta actividad se entrega con un texto', 'VALIDATION_ERROR');
  }

  if (fileAssetId) {
    // El archivo tiene que ser suyo, estar confirmado y ser de entrega: un id de un video
    // del autor no vale como entrega.
    const asset = await db.mediaAsset.findFirst({
      where: {
        id: fileAssetId,
        uploadedById: personId,
        status: 'READY',
        provider: 'STORAGE',
        kind: 'DOCUMENT',
      },
      select: { id: true },
    });
    if (!asset) throw new APIError('El archivo no está listo o no es tuyo', 'VALIDATION_ERROR');
  }

  const existing = await db.submission.findFirst({
    where: { enrollmentId, lessonAssignmentId: assignmentId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, status: true },
  });
  // Una entrega en revisión se puede reemplazar hasta que alguien la revise (23/9): la
  // revisión empieza cuando el instructor decide, no cuando el estudiante pulsa enviar. Lo que
  // no se toca es una aprobada: eso ya completó el tema.
  if (existing?.status === 'APPROVED') {
    throw new APIError('Esta actividad ya fue aprobada', 'CONFLICT');
  }

  const id = await db.$transaction(async (tx) => {
    const data = {
      status: 'SUBMITTED' as const,
      text,
      // Prisma quiere un JSON «plano»; un `Array` de objetos con tipo propio no le sirve tal cual.
      answers: answerRows ? (answerRows.map((a) => ({ ...a })) as JsonValue) : JSON_NULL,
      fileAssetId,
      submittedAt: now,
      reviewedById: null,
      reviewedAt: null,
    };
    const row = existing
      ? await tx.submission.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.submission.create({
          data: { institutionId, enrollmentId, lessonAssignmentId: assignmentId, ...data },
          select: { id: true },
        });

    // El tema pasa a «en curso» si aún no lo estaba: la entrega es evidencia de que se empezó.
    await tx.lessonProgress.upsert({
      where: {
        enrollmentId_lessonAssignmentId: { enrollmentId, lessonAssignmentId: assignmentId },
      },
      create: {
        institutionId,
        enrollmentId,
        studentId: personId,
        lessonAssignmentId: assignmentId,
        lessonVersionId: assignment.lessonVersionId,
        status: 'IN_PROGRESS',
        source: 'EVIDENCE',
        evidence: {},
        startedAt: now,
        lastActivityAt: now,
      },
      update: { lastActivityAt: now },
    });

    await tx.learningEvent.create({
      data: {
        institutionId,
        studentId: personId,
        enrollmentId,
        type: 'lesson.submission.sent',
        payload: {
          assignmentId,
          submissionId: row.id,
          resubmission: Boolean(existing),
          withFile: Boolean(fileAssetId),
        },
        occurredAt: now,
      },
    });

    return row.id;
  });

  // Aviso al equipo que revisa. Mejor esfuerzo: la entrega ya está guardada.
  try {
    const reviewers = await staffPersonIds(institutionId, ['INSTRUCTOR', 'ADMIN']);
    await notifyMany(institutionId, reviewers, {
      type: 'submission_received',
      title: existing ? 'Actividad reenviada' : 'Actividad nueva por revisar',
      body: `${assignment.lesson.title} · ${outline.cohort.code}`,
      href: `/cohortes/${outline.cohort.id}/actividades?estado=SUBMITTED`,
      dedupeKey: `submission_received:${id}:${now.toISOString().slice(0, 10)}`,
    });
  } catch {
    // Un aviso que falla no deshace una entrega.
  }

  const view = await getSubmissionForStudent({ institutionId, enrollmentId, assignmentId });
  if (!view) throw new APIError('No se pudo leer la actividad', 'INTERNAL');
  return view;
}
