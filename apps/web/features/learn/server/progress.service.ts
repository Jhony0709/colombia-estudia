/**
 * La evidencia de que un estudiante estudió un tema, y la decisión de si lo completó.
 * SSOT: plan/08-aprender-y-evaluar.md:36-40 (§2, «Evidencia»),
 * reference/04-business-logic/contenido-y-evaluaciones.md:145-153,
 * reference/02-api/endpoints.md:38, packages/domain/src/lesson-completion.ts.
 *
 * Reglas que se sostienen aquí:
 *
 * - **Quién puede dejar evidencia lo decide la misma secuencia que pinta la ruta.** Se pasa
 *   por `getCohortOutline` igual que para leer: un tema bloqueado no acumula evidencia
 *   aunque alguien conozca su id.
 * - **La evidencia solo crece.** Segundos, posición del video y las dos banderas se
 *   combinan con lo guardado (máximo, máximo, OR): una pestaña vieja que manda menos no
 *   deshace lo que otra ya mandó.
 * - **`COMPLETED` no se deshace desde aquí.** Solo `invalidatesProgress` de una republicación
 *   (pendiente) puede reabrir un tema; una evidencia nunca.
 * - **El servidor decide.** `isLessonCompleted` (dominio) con la forma del tema, la duración
 *   del video guardada en el asset y los minutos estimados de la versión. El cliente solo
 *   cuenta y mide.
 * - **`LearningEvent` en cada evidencia** (append-only): base del reporte para aliados.
 */

import 'server-only';

import { parseLessonMarkdown } from '@colombia-estudia/types';
import { isLessonCompleted, type LessonEvidence, type LessonForm } from '@colombia-estudia/domain';
import type { JsonObject } from '@/lib/db/prisma';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { getCohortOutline } from './cohort.service';
import { lessonFormOf } from './lesson-form';

export interface EvidenceInput {
  secondsOnLesson?: number;
  scrolledToEnd?: boolean;
  videoPositionSeconds?: number;
  /** Solo se usa si el asset no trae duración: el cliente la lee del player de Vimeo. */
  videoDurationSeconds?: number;
  transcriptReadToEnd?: boolean;
}

export interface EvidenceResult {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  /** `true` solo en la llamada que cambió el estado a COMPLETED: la UI lo anuncia una vez. */
  justCompleted: boolean;
  form: LessonForm;
  evidence: LessonEvidence;
  completedAt: string | null;
}

const clampSeconds = (value: number | undefined, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), max)
    : undefined;

/** Evidencia guardada + nueva: nunca decrece. */
export function mergeEvidence(
  saved: Record<string, unknown>,
  incoming: EvidenceInput
): LessonEvidence & { videoDurationSeconds?: number } {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const out: LessonEvidence & { videoDurationSeconds?: number } = {};

  const seconds = Math.max(
    num(saved.secondsOnLesson) ?? 0,
    clampSeconds(incoming.secondsOnLesson, 24 * 3600) ?? 0
  );
  if (seconds > 0) out.secondsOnLesson = seconds;

  const position = Math.max(
    num(saved.videoPositionSeconds) ?? 0,
    clampSeconds(incoming.videoPositionSeconds, 12 * 3600) ?? 0
  );
  if (position > 0) out.videoPositionSeconds = position;

  const duration =
    clampSeconds(incoming.videoDurationSeconds, 12 * 3600) ?? num(saved.videoDurationSeconds);
  if (duration) out.videoDurationSeconds = duration;

  if (saved.scrolledToEnd === true || incoming.scrolledToEnd === true) out.scrolledToEnd = true;
  if (saved.transcriptReadToEnd === true || incoming.transcriptReadToEnd === true)
    out.transcriptReadToEnd = true;

  return out;
}

export async function recordEvidence({
  institutionId,
  personId,
  assignmentId,
  input,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  input: EvidenceInput;
  now?: Date;
}): Promise<EvidenceResult> {
  const outline = await getCohortOutline({ institutionId, personId, now });
  if (outline.gate || !outline.cohort || !outline.enrollmentId) {
    throw new APIError('No hay una cohorte en la que estudiar', 'ACCESS_EXPIRED');
  }
  const enrollmentId = outline.enrollmentId;

  const item = outline.modules.flatMap((m) => m.items).find((i) => i.assignmentId === assignmentId);
  // Mudo a propósito (como el player): no confirma qué ids existen.
  if (!item || item.kind !== 'LESSON') throw new APIError('Not found', 'NOT_FOUND');
  if (!item.enabled) throw new APIError('Este tema todavía no está habilitado', 'LESSON_LOCKED');

  const db = createTenantClient(institutionId);

  const assignment = await db.lessonAssignment.findFirst({
    where: { id: assignmentId, cohortId: outline.cohort.id },
    select: {
      lessonVersionId: true,
      lesson: { select: { requiresSubmission: true } },
      lessonVersion: {
        select: {
          content: true,
          estimatedMinutes: true,
          assets: { select: { mediaAsset: { select: { kind: true, durationSeconds: true } } } },
        },
      },
    },
  });
  if (!assignment) throw new APIError('Not found', 'NOT_FOUND');

  const parsed = parseLessonMarkdown(assignment.lessonVersion.content);
  const form = lessonFormOf({ parsed, requiresSubmission: assignment.lesson.requiresSubmission });

  const existing = await db.lessonProgress.findUnique({
    where: { enrollmentId_lessonAssignmentId: { enrollmentId, lessonAssignmentId: assignmentId } },
    select: { id: true, status: true, evidence: true, startedAt: true, completedAt: true },
  });

  const saved = (
    typeof existing?.evidence === 'object' && existing?.evidence !== null ? existing.evidence : {}
  ) as Record<string, unknown>;
  const evidence = mergeEvidence(saved, input);

  // La duración guardada en el asset manda; la del cliente solo rellena si no hay.
  const storedDuration =
    assignment.lessonVersion.assets
      .map((a) => a.mediaAsset)
      .find((a) => a.kind === 'VIDEO' && a.durationSeconds)?.durationSeconds ?? null;
  const videoDurationSeconds = storedDuration ?? evidence.videoDurationSeconds ?? null;

  const alreadyCompleted = existing?.status === 'COMPLETED';
  const completes =
    !alreadyCompleted &&
    isLessonCompleted({
      form,
      evidence,
      videoDurationSeconds,
      estimatedMinutes: assignment.lessonVersion.estimatedMinutes,
      submissionStatus: null,
    });

  const status = alreadyCompleted ? 'COMPLETED' : completes ? 'COMPLETED' : 'IN_PROGRESS';
  const completedAt = alreadyCompleted ? existing!.completedAt : completes ? now : null;

  await db.$transaction(async (tx) => {
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
        status,
        source: 'EVIDENCE',
        evidence: evidence as JsonObject,
        startedAt: now,
        lastActivityAt: now,
        completedAt,
      },
      update: {
        status,
        evidence: evidence as JsonObject,
        lastActivityAt: now,
        ...(existing?.startedAt ? {} : { startedAt: now }),
        ...(completes ? { completedAt: now } : {}),
      },
    });

    const events: Array<{ type: string; payload: JsonObject }> = [];
    if (input.videoPositionSeconds !== undefined)
      events.push({
        type: 'lesson.video.progress',
        payload: { assignmentId, seconds: evidence.videoPositionSeconds ?? 0 },
      });
    if (input.transcriptReadToEnd)
      events.push({ type: 'lesson.transcript.read', payload: { assignmentId } });
    if (input.scrolledToEnd && saved.scrolledToEnd !== true)
      events.push({ type: 'lesson.scrolled_to_end', payload: { assignmentId } });
    if (!existing) events.push({ type: 'lesson.opened', payload: { assignmentId } });
    if (completes)
      events.push({
        type: 'lesson.completed',
        payload: { assignmentId, form, secondsOnLesson: evidence.secondsOnLesson ?? 0 },
      });

    if (events.length > 0) {
      await tx.learningEvent.createMany({
        data: events.map((e) => ({
          institutionId,
          studentId: personId,
          enrollmentId,
          type: e.type,
          payload: e.payload,
          occurredAt: now,
        })),
      });
    }
  });

  return {
    status,
    justCompleted: completes,
    form,
    evidence,
    completedAt: completedAt ? completedAt.toISOString() : null,
  };
}
