/**
 * El motor de intentos, del lado del estudiante.
 * SSOT: plan/08-aprender-y-evaluar.md:47-70 (§3), reference/02-api/endpoints.md:42-44,
 * reference/04-business-logic/contenido-y-evaluaciones.md (§Evaluaciones), prisma `Attempt`.
 *
 * La máquina de estados vive aquí y en `packages/domain` (`attempt-policy.ts` calcula el
 * plazo y los intentos; `grading.ts` califica). El cliente pinta y guarda; **no decide**:
 * ni cuándo vence, ni cuánto vale, ni si puede empezar otro.
 *
 * ```
 * start   → habilitado por la secuencia, intentos disponibles, ninguno IN_PROGRESS,
 *           congela los ajustes, calcula deadlineAt, crea Attempt + LearningEvent
 * answer  → PATCH idempotente por código de pregunta; ATTEMPT_EXPIRED si venció
 * submit  → grading.ts sobre answerKey; GRADED; Score derivado; LearningEvent
 * expire  → al primer request tras deadlineAt (y el job diario, Fase 5):
 *           con respuestas → submit; sin respuestas → EXPIRED
 * ```
 *
 * `answerKey` se lee **solo** en `gradeAndClose`, con `select` explícito (el cliente Prisma
 * la omite por defecto), y nunca sale de este archivo: lo que vuelve al estudiante es lo
 * que `reviewPolicy` permite.
 */

import 'server-only';

import {
  AssessmentContentSchema,
  AnswerKeySchema,
  type AssessmentContent,
} from '@colombia-estudia/types';
import {
  gradeAttempt,
  isPassing,
  deriveScore,
  getAttemptDeadline,
  getAttemptsAllowed,
} from '@colombia-estudia/domain';
import { renderInlineHtml } from '@colombia-estudia/types';
import { createTenantClient } from '@/lib/db/tenant';
import { issueAfterProgress } from '@/features/certificates/server/certificates.service';
import { APIError } from '@/lib/core/errors';
import type { JsonObject } from '@/lib/db/prisma';
import { notify } from '@/features/notifications/server/notifications.service';
import { getCohortOutline, listMyEnrollments, type OutlineModule } from './cohort.service';
import type { LessonGate } from './lesson.service';
import { assessmentStatus } from './outline';

export type ReviewPolicy =
  'NONE' | 'SCORE_ONLY' | 'FULL_AFTER_GRADED' | 'FULL_AFTER_DUE' | 'FULL_AFTER_LAST_ATTEMPT';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED';

/** Una respuesta guardada: lo que el estudiante marcó y cuándo. */
interface StoredAnswer {
  answer: unknown;
  answeredAt: string;
  pointsAwarded?: number;
  correct?: boolean;
  feedback?: string;
}

type StoredAnswers = Record<string, StoredAnswer>;

export interface AttemptSummary {
  id: string;
  number: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  /** Solo cuando `reviewPolicy` lo permite; si no, `null` aunque el intento esté calificado. */
  score: { value: number; max: number; percent: number; passed: boolean } | null;
}

export interface AssessmentForStudent {
  gate: LessonGate | null;
  assessment: {
    assignmentId: string;
    /** La matrícula por la que se abre (21/9): «volver a la ruta» vuelve a ESE programa. */
    enrollmentId: string;
    title: string;
    moduleName: string;
    /** Diagnóstico, parcial o final (21/9): la pantalla previa dice qué clase de examen es. */
    kind: 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL';
    /** La asignatura a cuya nota suma un parcial; nula en las demás. */
    subjectName: string | null;
    language: string;
    instructions: string | null;
    /** Las instrucciones en HTML seguro de una frase (27/9): el autor escribe `**` y se veía. */
    instructionsHtml: string | null;
    questionCount: number;
    totalPoints: number;
    /** Minutos ya multiplicados por el ajuste; `null` sin límite o con exención. */
    timeLimitMinutes: number | null;
    timerExempt: boolean;
    attemptsAllowed: number;
    attemptsUsed: number;
    dueAt: string | null;
    passPercent: number | null;
    reviewPolicy: ReviewPolicy;
  } | null;
  /** El intento abierto, si lo hay: la pantalla previa lleva a continuarlo, no a empezar otro. */
  active: { id: string; deadlineAt: string | null } | null;
  attempts: AttemptSummary[];
  /** Por qué no se puede empezar uno nuevo. `null` = se puede. */
  cannotStart: 'IN_PROGRESS' | 'NO_ATTEMPTS_LEFT' | 'PAST_DUE' | null;
  /** La ruta del programa, para la barra lateral (21/9). Vacía si no se abre. */
  route: OutlineModule[];
}

export interface AttemptQuestionView {
  code: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_text';
  text: string;
  /** El texto en HTML seguro, sin bloques (`renderInlineHtml`, 27/9): el player pintaba `**`. */
  textHtml: string;
  options: Array<{ code: string; text: string; textHtml: string }>;
  points: number;
  /** Lo guardado hasta ahora (en curso) o lo entregado (revisión). */
  answer: unknown;
  /** Solo en revisión completa. */
  correct: boolean | null;
  pointsAwarded: number | null;
  feedback: string | null;
  feedbackHtml: string | null;
}

export interface AttemptForStudent {
  id: string;
  assignmentId: string;
  number: number;
  status: AttemptStatus;
  title: string;
  language: string;
  instructions: string | null;
  instructionsHtml: string | null;
  /** El cierre del componente (25/9), si el equipo lo escribió; si no, el general. */
  closingText: string | null;
  /**
   * Hay cronómetro solo si el examen tiene límite de tiempo y el estudiante no está exento
   * (decisión de Jhonny, 27/9). `deadlineAt` puede venir de la fecha de entrega o del fin de
   * acceso, y eso es una fecha, no un reloj.
   */
  timed: boolean;
  deadlineAt: string | null;
  serverNow: string;
  submittedAt: string | null;
  reviewPolicy: ReviewPolicy;
  /** Qué se enseña tras calificar: nada, la nota, o cada pregunta. */
  review: 'NONE' | 'SCORE' | 'FULL';
  score: { value: number; max: number; percent: number; passed: boolean } | null;
  questions: AttemptQuestionView[];
  /**
   * Qué sigue (8/10): aprobó; aprobó en otro intento (este se ve desde el historial); puede
   * reintentar (y no sigue hasta agotar los intentos); ya no le quedan (sigue igual); o espera
   * calificación. Nulo mientras está en curso. Se calcula con la
   * nota real aunque la política no la muestre: decide el paso, no enseña el número.
   */
  outcome: 'PASSED' | 'PASSED_OTHER' | 'RETRY' | 'DONE' | 'PENDING' | null;
  attemptsLeft: number;
  /** Otro intento de este cuestionario que sigue abierto: se continúa ese, no se empieza otro. */
  activeAttemptId: string | null;
  /** El siguiente paso de la ruta cuando el cuestionario quedó completo; si no hay, la ruta. */
  next: { href: string; title: string | null } | null;
}

const blocked = (gate: LessonGate): AssessmentForStudent => ({
  gate,
  assessment: null,
  active: null,
  attempts: [],
  cannotStart: null,
  route: [],
});

const num = (d: { toNumber(): number } | number | null): number | null =>
  d === null ? null : typeof d === 'number' ? d : d.toNumber();

function parseAnswers(raw: unknown): StoredAnswers {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: StoredAnswers = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null && 'answer' in value) {
      out[code] = value as StoredAnswer;
    }
  }
  return out;
}

function parseContent(raw: unknown): AssessmentContent {
  const parsed = AssessmentContentSchema.safeParse(raw);
  // Una versión publicada pasó la validación de publicación; si aun así no cuadra, la
  // evaluación no se puede rendir, y se dice como error del servidor, no del estudiante.
  if (!parsed.success) throw new APIError('Assessment content is invalid', 'INTERNAL');
  return parsed.data;
}

/**
 * Qué revisión permite la política **ahora**.
 *
 * `FULL_AFTER_DUE` sin `dueAt` no tiene un «después» que esperar: se trata como
 * `FULL_AFTER_GRADED`. Está anotado en PRODUCT_DECISIONS (19/9).
 *
 * `FULL_AFTER_LAST_ATTEMPT` (3/10, cliente): la nota siempre; cada pregunta con su respuesta
 * correcta solo cuando el examen ya no se puede volver a presentar —se agotaron los intentos
 * o aprobó—. Mientras queden intentos, enseñar las respuestas sería regalar el siguiente.
 */
function reviewLevel({
  policy,
  status,
  dueAt,
  now,
  exhausted,
}: {
  policy: ReviewPolicy;
  status: AttemptStatus;
  dueAt: Date | null;
  now: Date;
  /** Sin intentos por delante: se usaron todos o alguno aprobó. */
  exhausted: boolean;
}): 'NONE' | 'SCORE' | 'FULL' {
  if (status !== 'GRADED') return 'NONE';
  switch (policy) {
    case 'NONE':
      return 'NONE';
    case 'SCORE_ONLY':
      return 'SCORE';
    case 'FULL_AFTER_GRADED':
      return 'FULL';
    case 'FULL_AFTER_DUE':
      return dueAt === null || dueAt <= now ? 'FULL' : 'SCORE';
    case 'FULL_AFTER_LAST_ATTEMPT':
      return exhausted ? 'FULL' : 'SCORE';
  }
}

/**
 * Si ya no hay más intentos que jugar: alguno aprobó, o se usaron todos los permitidos y
 * ninguno sigue abierto. Con el último en curso todavía no (8/10): las respuestas correctas
 * de un intento anterior servirían para el que está abierto.
 */
export function attemptsExhausted({
  attempts,
  attemptsAllowed,
  passPercent,
}: {
  attempts: Array<{
    status: string;
    score: { toNumber(): number } | null;
    maxScore: { toNumber(): number } | null;
  }>;
  attemptsAllowed: number;
  passPercent: number | null;
}): boolean {
  if (attempts.some((a) => a.status === 'GRADED' && scoreView(a, passPercent)?.passed === true)) {
    return true;
  }
  const open = attempts.some((a) => a.status === 'IN_PROGRESS');
  return !open && attempts.length >= attemptsAllowed;
}

function scoreView(
  row: { score: { toNumber(): number } | null; maxScore: { toNumber(): number } | null },
  passPercent: number | null
) {
  const value = num(row.score);
  const max = num(row.maxScore);
  if (value === null || max === null) return null;
  const percent = max > 0 ? Math.round((value / max) * 10000) / 100 : 0;
  return { value, max, percent, passed: isPassing({ score: value, maxScore: max, passPercent }) };
}

// ─────────────────────────── expire / grade ───────────────────────────

/**
 * Califica y cierra un intento. Es el único sitio que lee `answerKey`.
 *
 * `expired = true` es el cierre por plazo con respuestas: se califica igual (plan §3
 * «vencido con respuestas → entregado y calificado») y queda constancia en el evento.
 */
async function gradeAndClose({
  institutionId,
  attemptId,
  now,
  expired,
}: {
  institutionId: string;
  attemptId: string;
  now: Date;
  expired: boolean;
}): Promise<void> {
  const db = createTenantClient(institutionId);

  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, status: 'IN_PROGRESS' },
    select: {
      id: true,
      answers: true,
      enrollmentId: true,
      studentId: true,
      assessmentAssignmentId: true,
      assessmentVersion: {
        select: {
          content: true,
          // Lectura explícita y única de la clave: el cliente la omite en todo lo demás.
          answerKey: true,
          passPercent: true,
          assessment: { select: { id: true, kind: true, subjectId: true, title: true } },
        },
      },
      assignment: { select: { cohortId: true } },
    },
  });
  if (!attempt) return;

  const content = parseContent(attempt.assessmentVersion.content);
  const answerKey = AnswerKeySchema.parse(attempt.assessmentVersion.answerKey);
  const answers = parseAnswers(attempt.answers);

  const result = gradeAttempt({
    content,
    answerKey,
    answers: Object.fromEntries(
      Object.entries(answers).map(([code, a]) => [code, { answer: a.answer }])
    ),
  });

  // Se guarda por pregunta lo que la revisión completa va a enseñar. El `feedback` de la
  // clave se copia aquí, y por eso la revisión no vuelve a abrir `answerKey`.
  const graded: StoredAnswers = { ...answers };
  for (const q of result.perQuestion) {
    const prev = graded[q.code] ?? { answer: null, answeredAt: now.toISOString() };
    graded[q.code] = {
      ...prev,
      pointsAwarded: q.pointsAwarded,
      correct: q.correct,
      ...(answerKey[q.code]?.feedback ? { feedback: answerKey[q.code]!.feedback } : {}),
    };
  }

  const { kind, subjectId } = attempt.assessmentVersion.assessment;
  const passed = isPassing({
    score: result.score,
    maxScore: result.maxScore,
    passPercent: attempt.assessmentVersion.passPercent,
  });

  await db.$transaction(async (tx) => {
    await tx.attempt.update({
      where: { id: attempt.id },
      data: {
        status: 'GRADED',
        answers: graded as unknown as JsonObject,
        submittedAt: now,
        gradedAt: now,
        score: result.score,
        maxScore: result.maxScore,
      },
    });

    await tx.learningEvent.createMany({
      data: [
        {
          institutionId,
          studentId: attempt.studentId,
          enrollmentId: attempt.enrollmentId,
          type: 'attempt.submitted',
          payload: { attemptId: attempt.id, expired, answered: Object.keys(answers).length },
          occurredAt: now,
        },
        {
          institutionId,
          studentId: attempt.studentId,
          enrollmentId: attempt.enrollmentId,
          type: 'attempt.graded',
          payload: {
            attemptId: attempt.id,
            score: result.score,
            maxScore: result.maxScore,
            passed,
            auto: true,
          },
          occurredAt: now,
        },
      ],
    });

    // La nota de la asignatura se deriva del mejor intento calificado de su evaluación
    // SUBJECT (schema `Score`). Se persiste para consulta; nadie la edita a mano aquí.
    if (kind === 'SUBJECT' && subjectId) {
      const all = await tx.attempt.findMany({
        where: {
          enrollmentId: attempt.enrollmentId,
          assessmentAssignmentId: attempt.assessmentAssignmentId,
          status: 'GRADED',
        },
        select: { id: true, status: true, score: true, maxScore: true },
      });
      const derived = deriveScore(
        all.map((a) => ({
          id: a.id,
          status: a.status as AttemptStatus,
          score: num(a.score) ?? 0,
          maxScore: num(a.maxScore) ?? 0,
        }))
      );
      if (derived) {
        await tx.score.upsert({
          where: { enrollmentId_subjectId: { enrollmentId: attempt.enrollmentId, subjectId } },
          create: {
            institutionId,
            enrollmentId: attempt.enrollmentId,
            studentId: attempt.studentId,
            subjectId,
            cohortId: attempt.assignment.cohortId,
            value: derived.value,
            sourceAttemptId: derived.sourceAttemptId,
            publishedAt: now,
          },
          update: { value: derived.value, sourceAttemptId: derived.sourceAttemptId },
        });
      }
    }
  });

  await notify(institutionId, {
    personId: attempt.studentId,
    type: 'attempt_graded',
    title: expired ? 'Tu examen se entregó al vencer el tiempo' : 'Tu examen fue calificado',
    body: `${attempt.assessmentVersion.assessment.title}: ya puedes ver el resultado en tus resultados.`,
    href: `/aprender/examen/${attempt.assessmentAssignmentId}/intento/${attempt.id}`,
    dedupeKey: `attempt_graded:${attempt.id}`,
  });

  // Si era el último paso, la matrícula se cierra ya y no al pasar el job.
  await issueAfterProgress({ institutionId, enrollmentId: attempt.enrollmentId, now });
}

/**
 * Cierra por plazo un intento `IN_PROGRESS` cuyo `deadlineAt` ya pasó. Con respuestas se
 * califica; sin ninguna queda `EXPIRED`. Se llama al primer request que lo encuentra
 * vencido; el job diario (Fase 5) hará lo mismo con los que nadie vuelva a abrir.
 */
export async function expireIfDue({
  institutionId,
  attempt,
  now,
}: {
  institutionId: string;
  attempt: { id: string; status: string; deadlineAt: Date | null; answers: unknown };
  now: Date;
}): Promise<boolean> {
  if (attempt.status !== 'IN_PROGRESS') return false;
  if (attempt.deadlineAt === null || attempt.deadlineAt > now) return false;

  const answers = parseAnswers(attempt.answers);
  if (Object.keys(answers).length > 0) {
    await gradeAndClose({ institutionId, attemptId: attempt.id, now, expired: true });
    return true;
  }

  const db = createTenantClient(institutionId);
  const row = await db.attempt.update({
    where: { id: attempt.id },
    data: { status: 'EXPIRED', submittedAt: now },
    select: { studentId: true, enrollmentId: true },
  });
  await db.learningEvent.create({
    data: {
      institutionId,
      studentId: row.studentId,
      enrollmentId: row.enrollmentId,
      type: 'attempt.submitted',
      payload: { attemptId: attempt.id, expired: true, answered: 0 },
      occurredAt: now,
    },
  });
  return true;
}

// ─────────────────────────── pre-screen ───────────────────────────

interface Resolved {
  view: AssessmentForStudent;
  /** Solo con `view.assessment`: la matrícula y la cohorte del estudiante que pregunta. */
  enrollmentId: string | null;
  cohortId: string | null;
}

const denied = (gate: LessonGate): Resolved => ({
  view: blocked(gate),
  enrollmentId: null,
  cohortId: null,
});

export async function getAssessmentForStudent(input: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  now?: Date;
}): Promise<AssessmentForStudent> {
  return (await resolveAssessment(input)).view;
}

async function resolveAssessment({
  institutionId,
  personId,
  assignmentId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  now?: Date;
}): Promise<Resolved> {
  const outline = await getCohortOutline({ institutionId, personId, assignmentId, now });
  if (outline.gate || !outline.cohort || !outline.enrollmentId) {
    return denied({ kind: 'COHORT', cohort: outline.gate ?? { kind: 'NO_ENROLLMENT' } });
  }
  const item = outline.modules.flatMap((m) => m.items).find((i) => i.assignmentId === assignmentId);
  if (!item || item.kind !== 'ASSESSMENT') return denied({ kind: 'NOT_ASSIGNED' });
  if (!item.enabled) {
    return denied(
      item.blockedBy
        ? { kind: 'BLOCKED', blockedBy: item.blockedBy }
        : item.unavailableReason === 'NOT_YET'
          ? { kind: 'NOT_YET' }
          : item.unavailableReason === 'LOCKED'
            ? { kind: 'LOCKED' }
            : { kind: 'CLOSED' }
    );
  }

  const db = createTenantClient(institutionId);
  const enrollmentId = outline.enrollmentId;

  const assignment = await db.assessmentAssignment.findFirst({
    where: { id: assignmentId, cohortId: outline.cohort.id },
    select: {
      id: true,
      dueAt: true,
      assessment: {
        select: {
          title: true,
          language: true,
          kind: true,
          module: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
      assessmentVersion: {
        select: {
          content: true,
          maxAttempts: true,
          timeLimitMinutes: true,
          passPercent: true,
          reviewPolicy: true,
        },
      },
    },
  });
  if (!assignment) return denied({ kind: 'NOT_ASSIGNED' });

  const accommodation = await db.accommodation.findFirst({
    where: { enrollmentId },
    select: { extraTimeFactor: true, exemptFromTimer: true, allowedAttemptsBonus: true },
  });

  let attempts = await db.attempt.findMany({
    where: { enrollmentId, assessmentAssignmentId: assignmentId },
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      deadlineAt: true,
      answers: true,
      score: true,
      maxScore: true,
    },
  });

  // Un intento abierto que ya venció se cierra aquí, antes de decidir nada sobre él.
  for (const a of attempts) {
    if (await expireIfDue({ institutionId, attempt: a, now })) {
      attempts = await db.attempt.findMany({
        where: { enrollmentId, assessmentAssignmentId: assignmentId },
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          deadlineAt: true,
          answers: true,
          score: true,
          maxScore: true,
        },
      });
      break;
    }
  }

  const version = assignment.assessmentVersion;
  const content = parseContent(version.content);
  const policy = version.reviewPolicy as ReviewPolicy;
  const attemptsAllowed = getAttemptsAllowed({
    assessmentVersion: {
      id: '',
      timeLimitMinutes: version.timeLimitMinutes,
      maxAttempts: version.maxAttempts,
    },
    accommodation: accommodation
      ? {
          enrollmentId,
          extraTimeFactor: accommodation.extraTimeFactor.toNumber(),
          exemptFromTimer: accommodation.exemptFromTimer,
          allowedAttemptsBonus: accommodation.allowedAttemptsBonus,
        }
      : null,
  });
  const timerExempt = accommodation?.exemptFromTimer ?? false;
  const factor = accommodation?.extraTimeFactor.toNumber() ?? 1;
  const timeLimitMinutes =
    version.timeLimitMinutes === null || timerExempt
      ? null
      : Math.round(version.timeLimitMinutes * factor);

  const active = attempts.find((a) => a.status === 'IN_PROGRESS') ?? null;
  const cannotStart: AssessmentForStudent['cannotStart'] = active
    ? 'IN_PROGRESS'
    : attempts.length >= attemptsAllowed
      ? 'NO_ATTEMPTS_LEFT'
      : assignment.dueAt !== null && assignment.dueAt <= now
        ? 'PAST_DUE'
        : null;

  const view: AssessmentForStudent = {
    gate: null,
    assessment: {
      assignmentId,
      enrollmentId,
      title: assignment.assessment.title,
      moduleName: assignment.assessment.module?.name ?? '',
      kind: assignment.assessment.kind as 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL',
      subjectName: assignment.assessment.subject?.name ?? null,
      language: assignment.assessment.language,
      instructions: content.instructions ?? null,
      instructionsHtml: content.instructions ? renderInlineHtml(content.instructions) : null,
      questionCount: content.questions.length,
      totalPoints: content.questions.reduce((sum, q) => sum + q.points, 0),
      timeLimitMinutes,
      timerExempt,
      attemptsAllowed,
      attemptsUsed: attempts.length,
      dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
      passPercent: version.passPercent,
      reviewPolicy: policy,
    },
    active: active
      ? { id: active.id, deadlineAt: active.deadlineAt ? active.deadlineAt.toISOString() : null }
      : null,
    attempts: attempts.map((a) => ({
      id: a.id,
      number: a.number,
      status: a.status as AttemptStatus,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      score:
        reviewLevel({
          policy,
          status: a.status as AttemptStatus,
          dueAt: assignment.dueAt,
          now,
          exhausted: attemptsExhausted({
            attempts,
            attemptsAllowed,
            passPercent: version.passPercent,
          }),
        }) === 'NONE'
          ? null
          : scoreView(a, version.passPercent),
    })),
    cannotStart,
    route: outline.modules,
  };
  return { view, enrollmentId, cohortId: outline.cohort.id };
}

// ─────────────────────────── start ───────────────────────────

export async function startAttempt({
  institutionId,
  personId,
  assignmentId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  now?: Date;
}): Promise<{ attemptId: string; deadlineAt: string | null }> {
  const { view, enrollmentId } = await resolveAssessment({
    institutionId,
    personId,
    assignmentId,
    now,
  });
  if (view.gate || !view.assessment || !enrollmentId) {
    if (view.gate?.kind === 'NOT_ASSIGNED') throw new APIError('Not found', 'NOT_FOUND');
    if (view.gate?.kind === 'COHORT') throw new APIError('No access', 'ACCESS_EXPIRED');
    throw new APIError('Este examen todavía no está habilitado', 'LESSON_LOCKED');
  }
  if (view.cannotStart === 'IN_PROGRESS' && view.active) {
    // Idempotente: volver a pulsar «Empezar» continúa el mismo intento.
    return { attemptId: view.active.id, deadlineAt: view.active.deadlineAt };
  }
  if (view.cannotStart === 'NO_ATTEMPTS_LEFT') {
    throw new APIError('No te quedan intentos', 'CONFLICT');
  }
  if (view.cannotStart === 'PAST_DUE') {
    throw new APIError('El plazo de este examen ya pasó', 'ATTEMPT_EXPIRED');
  }
  const number = view.assessment.attemptsUsed + 1;

  const db = createTenantClient(institutionId);
  const [assignment, enrollment, accommodation] = await Promise.all([
    db.assessmentAssignment.findFirstOrThrow({
      where: { id: assignmentId },
      select: {
        id: true,
        dueAt: true,
        assessmentVersionId: true,
        assessmentVersion: { select: { maxAttempts: true, timeLimitMinutes: true } },
      },
    }),
    db.enrollment.findFirstOrThrow({
      where: { id: enrollmentId, studentId: personId },
      select: { id: true, accessUntil: true },
    }),
    db.accommodation.findFirst({
      where: { enrollmentId },
      select: {
        extraTimeFactor: true,
        exemptFromTimer: true,
        allowedAttemptsBonus: true,
        requiresCaptions: true,
        allowsAssistiveTech: true,
      },
    }),
  ]);

  const snapshot = accommodation
    ? {
        extraTimeFactor: accommodation.extraTimeFactor.toNumber(),
        exemptFromTimer: accommodation.exemptFromTimer,
        allowedAttemptsBonus: accommodation.allowedAttemptsBonus,
        requiresCaptions: accommodation.requiresCaptions,
        allowsAssistiveTech: accommodation.allowsAssistiveTech,
      }
    : null;

  const deadlineAt = getAttemptDeadline({
    assessmentVersion: {
      id: assignment.assessmentVersionId,
      timeLimitMinutes: assignment.assessmentVersion.timeLimitMinutes,
      maxAttempts: assignment.assessmentVersion.maxAttempts,
    },
    assignment: { id: assignment.id, dueAt: assignment.dueAt },
    enrollment: {
      id: enrollment.id,
      studentId: personId,
      cohortId: '',
      status: 'ACTIVE',
      isMinorAtEnrollment: false,
      accessUntil: enrollment.accessUntil,
    },
    accommodation: snapshot
      ? {
          enrollmentId: enrollment.id,
          extraTimeFactor: snapshot.extraTimeFactor,
          exemptFromTimer: snapshot.exemptFromTimer,
          allowedAttemptsBonus: snapshot.allowedAttemptsBonus,
        }
      : null,
    startedAt: now,
  });

  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.attempt.create({
      data: {
        institutionId,
        enrollmentId: enrollment.id,
        studentId: personId,
        assessmentAssignmentId: assignmentId,
        assessmentVersionId: assignment.assessmentVersionId,
        number,
        status: 'IN_PROGRESS',
        source: 'EVIDENCE',
        answers: {},
        ...(snapshot ? { appliedAccommodation: snapshot } : {}),
        startedAt: now,
        deadlineAt,
      },
      select: { id: true },
    });
    await tx.learningEvent.create({
      data: {
        institutionId,
        studentId: personId,
        enrollmentId: enrollment.id,
        type: 'attempt.started',
        payload: {
          attemptId: created.id,
          assignmentId,
          number,
          deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
          accommodated: snapshot !== null,
        },
        occurredAt: now,
      },
    });
    return created;
  });

  return { attemptId: attempt.id, deadlineAt: deadlineAt ? deadlineAt.toISOString() : null };
}

// ─────────────────────────── answer / submit ───────────────────────────

const ATTEMPT_SELECT = {
  id: true,
  number: true,
  status: true,
  answers: true,
  startedAt: true,
  deadlineAt: true,
  submittedAt: true,
  score: true,
  maxScore: true,
  assessmentAssignmentId: true,
  appliedAccommodation: true,
  assessmentVersion: {
    select: {
      content: true,
      passPercent: true,
      reviewPolicy: true,
      timeLimitMinutes: true,
      maxAttempts: true,
      assessment: {
        select: {
          title: true,
          language: true,
          closingText: true,
          module: { select: { closingText: true } },
        },
      },
    },
  },
} as const;

/**
 * El intento con los hermanos del mismo estudiante en la misma asignación:
 * `FULL_AFTER_LAST_ATTEMPT` necesita saber si quedan (3/10).
 */
function attemptSelect(personId: string) {
  return {
    ...ATTEMPT_SELECT,
    assignment: {
      select: {
        dueAt: true,
        attempts: {
          where: { studentId: personId },
          select: { id: true, status: true, score: true, maxScore: true },
        },
      },
    },
  } as const;
}

/** El intento, del estudiante que pregunta, ya cerrado por plazo si tocaba. */
async function loadOwnAttempt({
  institutionId,
  personId,
  attemptId,
  now,
}: {
  institutionId: string;
  personId: string;
  attemptId: string;
  now: Date;
}) {
  const db = createTenantClient(institutionId);
  // `studentId` en el `where`: un intento ajeno no existe para quien pregunta.
  let row = await db.attempt.findFirst({
    where: { id: attemptId, studentId: personId },
    select: attemptSelect(personId),
  });
  if (!row) throw new APIError('Not found', 'NOT_FOUND');
  if (await expireIfDue({ institutionId, attempt: row, now })) {
    row = await db.attempt.findFirst({
      where: { id: attemptId, studentId: personId },
      select: attemptSelect(personId),
    });
    if (!row) throw new APIError('Not found', 'NOT_FOUND');
  }
  return row;
}

/**
 * Guarda respuestas. Idempotente por código de pregunta: mandar la misma dos veces deja
 * una. Rechaza códigos que no existen en la versión y respuestas de forma imposible para
 * el tipo (una lista en una pregunta de una sola opción).
 */
export async function saveAnswers({
  institutionId,
  personId,
  attemptId,
  answers,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  attemptId: string;
  answers: Record<string, unknown>;
  now?: Date;
}): Promise<{ savedAt: string; deadlineAt: string | null; answered: number }> {
  const row = await loadOwnAttempt({ institutionId, personId, attemptId, now });
  if (row.status !== 'IN_PROGRESS') {
    throw new APIError('Este intento ya se cerró', 'ATTEMPT_EXPIRED');
  }

  const content = parseContent(row.assessmentVersion.content);
  const byCode = new Map(content.questions.map((q) => [q.code, q]));
  const stored = parseAnswers(row.answers);

  for (const [code, answer] of Object.entries(answers)) {
    const question = byCode.get(code);
    if (!question) throw new APIError(`Unknown question: ${code}`, 'VALIDATION_ERROR');
    const valid =
      answer === null ||
      (question.type === 'multiple_choice'
        ? Array.isArray(answer) && answer.every((a) => typeof a === 'string')
        : typeof answer === 'string');
    if (!valid) throw new APIError(`Invalid answer for ${code}`, 'VALIDATION_ERROR');

    if (answer === null || (typeof answer === 'string' && answer.trim() === '')) {
      delete stored[code];
    } else {
      stored[code] = { answer, answeredAt: now.toISOString() };
    }
  }

  const db = createTenantClient(institutionId);
  await db.attempt.update({
    where: { id: row.id },
    data: { answers: stored as unknown as JsonObject },
  });

  return {
    savedAt: now.toISOString(),
    deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null,
    answered: Object.keys(stored).length,
  };
}

/** Entrega: califica y cierra. Devuelve el intento tal como la política deja verlo. */
export async function submitAttempt({
  institutionId,
  personId,
  attemptId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  attemptId: string;
  now?: Date;
}): Promise<AttemptForStudent> {
  const row = await loadOwnAttempt({ institutionId, personId, attemptId, now });
  if (row.status === 'IN_PROGRESS') {
    await gradeAndClose({ institutionId, attemptId: row.id, now, expired: false });
  }
  // Si ya estaba cerrado (doble clic, reintento de red) se devuelve lo que hay: entregar
  // dos veces no es un error para quien lo hace.
  return getAttemptForStudent({ institutionId, personId, attemptId, now });
}

// ─────────────────────────── attempt view ───────────────────────────

export async function getAttemptForStudent({
  institutionId,
  personId,
  attemptId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  attemptId: string;
  now?: Date;
}): Promise<AttemptForStudent> {
  const row = await loadOwnAttempt({ institutionId, personId, attemptId, now });
  const content = parseContent(row.assessmentVersion.content);
  const policy = row.assessmentVersion.reviewPolicy as ReviewPolicy;
  const status = row.status as AttemptStatus;
  const accommodation = row.appliedAccommodation as { allowedAttemptsBonus?: number } | null;
  const attemptsAllowed =
    row.assessmentVersion.maxAttempts + (accommodation?.allowedAttemptsBonus ?? 0);
  const passPercent = row.assessmentVersion.passPercent;
  const review = reviewLevel({
    policy,
    status,
    dueAt: row.assignment.dueAt,
    now,
    exhausted: attemptsExhausted({
      attempts: row.assignment.attempts,
      attemptsAllowed,
      passPercent,
    }),
  });

  const outcome: AttemptForStudent['outcome'] =
    status === 'IN_PROGRESS'
      ? null
      : status === 'SUBMITTED'
        ? 'PENDING'
        : status === 'GRADED' && scoreView(row, passPercent)?.passed === true
          ? 'PASSED'
          : row.assignment.attempts.some(
                (a) =>
                  a.id !== row.id &&
                  a.status === 'GRADED' &&
                  scoreView(a, passPercent)?.passed === true
              )
            ? 'PASSED_OTHER'
            : assessmentStatus(row.assignment.attempts, { attemptsAllowed, passPercent }) ===
                'COMPLETED'
              ? 'DONE'
              : 'RETRY';
  // El botón de seguir lleva al paso que sigue en la ruta, no al panel (8/10).
  let next: AttemptForStudent['next'] = null;
  if (outcome === 'PASSED' || outcome === 'PASSED_OTHER' || outcome === 'DONE') {
    const outline = await getCohortOutline({
      institutionId,
      personId,
      assignmentId: row.assessmentAssignmentId,
      now,
    });
    const step = outline.resume;
    next = step
      ? {
          href:
            step.kind === 'LESSON'
              ? `/aprender/tema/${step.assignmentId}`
              : `/aprender/examen/${step.assignmentId}`,
          title: step.title,
        }
      : {
          href: outline.enrollmentId ? `/aprender/curso/${outline.enrollmentId}` : '/aprender',
          title: null,
        };
  }
  const stored = parseAnswers(row.answers);

  return {
    id: row.id,
    assignmentId: row.assessmentAssignmentId,
    number: row.number,
    status,
    title: row.assessmentVersion.assessment.title,
    language: row.assessmentVersion.assessment.language,
    instructions: content.instructions ?? null,
    instructionsHtml: content.instructions ? renderInlineHtml(content.instructions) : null,
    // El cierre del taller (3/10) manda; si no hay, el del componente; si no, el general.
    closingText:
      row.assessmentVersion.assessment.closingText ??
      row.assessmentVersion.assessment.module?.closingText ??
      null,
    timed:
      row.assessmentVersion.timeLimitMinutes !== null &&
      !(row.appliedAccommodation as { exemptFromTimer?: boolean } | null)?.exemptFromTimer,
    deadlineAt: row.deadlineAt ? row.deadlineAt.toISOString() : null,
    serverNow: now.toISOString(),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    reviewPolicy: policy,
    review,
    score: review === 'NONE' ? null : scoreView(row, row.assessmentVersion.passPercent),
    questions: content.questions.map((q) => {
      const a = stored[q.code];
      return {
        code: q.code,
        type: q.type,
        text: q.text,
        textHtml: renderInlineHtml(q.text),
        options: (q.options ?? []).map((o) => ({ ...o, textHtml: renderInlineHtml(o.text) })),
        points: q.points,
        answer: a?.answer ?? null,
        correct: review === 'FULL' ? (a?.correct ?? false) : null,
        pointsAwarded: review === 'FULL' ? (a?.pointsAwarded ?? 0) : null,
        feedback: review === 'FULL' ? (a?.feedback ?? null) : null,
        feedbackHtml: review === 'FULL' && a?.feedback ? renderInlineHtml(a.feedback) : null,
      };
    }),
    outcome,
    attemptsLeft: Math.max(0, attemptsAllowed - row.assignment.attempts.length),
    activeAttemptId:
      row.assignment.attempts.find((a) => a.status === 'IN_PROGRESS' && a.id !== row.id)?.id ??
      null,
    next,
  };
}

// ─────────────────────────── results ───────────────────────────

export interface ResultsForStudent {
  /** Notas por asignatura (schema `Score`), de todas las matrículas. */
  scores: Array<{
    subjectName: string;
    cohortId: string;
    cohortCode: string;
    programName: string;
    value: number;
    updatedAt: string;
  }>;
  /**
   * Los programas con algo que mostrar (8/10), para agrupar la página: los de la persona, del
   * activo al terminado. `CLOSED`: acceso vencido, retirado o aún no empieza.
   */
  programs: Array<{
    cohortId: string;
    programName: string;
    cohortName: string;
    state: 'ACTIVE' | 'COMPLETED' | 'CLOSED';
  }>;
  /**
   * Mis exámenes (21/9): uno por examen asignado en las cohortes activas, esté hecho o no —
   * como la tabla «Calificaciones» de Coursera, que enseña también lo bloqueado y lo que
   * vence. La nota es la mejor visible según la política de revisión.
   */
  assessments: Array<{
    assignmentId: string;
    title: string;
    moduleName: string;
    /** El taller del cuestionario; nulo si es del componente. */
    subjectName: string | null;
    cohortId: string;
    cohortCode: string;
    programName: string;
    /**
     * Sacado de los intentos (8/10): su programa ya no está activo (terminado, vencido), así que
     * la ruta no lo trae. Se ve la nota y el historial; no se abre.
     */
    fromHistory: boolean;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    enabled: boolean;
    blockedBy: string | null;
    /** Por qué no está disponible cuando no es por secuencia (E3, 23/9). */
    unavailableReason: 'NOT_YET' | 'CLOSED' | 'LOCKED' | null;
    dueAt: string | null;
    best: { percent: number; passed: boolean } | null;
    /** Intentos con nota visible (E3): para decir «se conserva tu mejor intento de N». */
    visibleAttempts: number;
    /** El umbral de la versión asignada (4/10), para pintar la nota contra él. Nulo = sin umbral. */
    passPercent: number | null;
  }>;
  /** Intentos, del más reciente al más antiguo, con lo que la política deja ver. */
  attempts: Array<{
    id: string;
    assignmentId: string;
    title: string;
    moduleName: string;
    subjectName: string | null;
    cohortId: string;
    cohortCode: string;
    programName: string;
    number: number;
    status: AttemptStatus;
    submittedAt: string | null;
    score: { value: number; max: number; percent: number; passed: boolean } | null;
  }>;
}

/**
 * Funciona con el acceso vencido (`score.read.own` sobrevive a `accessUntil`): no pasa por
 * la secuencia ni por la cohorte, lee lo que es del estudiante y ya.
 */
/**
 * Si la persona ya tiene algo que ver en «Resultados» (6/10): una nota o un intento entregado.
 * Sin eso la pestaña no se muestra; el primer día era un destino vacío más en la barra.
 */
export async function hasResults({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<boolean> {
  const db = createTenantClient(institutionId);
  const [score, attempt] = await Promise.all([
    db.score.findFirst({ where: { studentId: personId }, select: { id: true } }),
    db.attempt.findFirst({
      where: { studentId: personId, status: { not: 'IN_PROGRESS' } },
      select: { id: true },
    }),
  ]);
  return score !== null || attempt !== null;
}

export async function getResultsForStudent({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<ResultsForStudent> {
  const db = createTenantClient(institutionId);
  const [scores, attempts] = await Promise.all([
    db.score.findMany({
      where: { studentId: personId },
      orderBy: { updatedAt: 'desc' },
      select: {
        value: true,
        updatedAt: true,
        subject: { select: { name: true } },
        cohort: { select: { id: true, code: true, program: { select: { name: true } } } },
      },
    }),
    db.attempt.findMany({
      where: { studentId: personId },
      orderBy: [{ startedAt: 'desc' }],
      select: {
        id: true,
        number: true,
        status: true,
        submittedAt: true,
        deadlineAt: true,
        answers: true,
        score: true,
        maxScore: true,
        assessmentAssignmentId: true,
        appliedAccommodation: true,
        assignment: {
          select: {
            dueAt: true,
            cohort: { select: { id: true, code: true, program: { select: { name: true } } } },
            assessment: {
              select: {
                title: true,
                module: { select: { name: true } },
                subject: { select: { name: true } },
              },
            },
          },
        },
        assessmentVersion: {
          select: { passPercent: true, reviewPolicy: true, maxAttempts: true },
        },
      },
    }),
  ]);

  // Lo vencido se cierra al leer, también aquí: la lista de resultados no debe enseñar
  // «en curso» un intento cuyo plazo pasó hace días.
  for (const a of attempts) await expireIfDue({ institutionId, attempt: a, now });

  // Hermanos por asignación: `FULL_AFTER_LAST_ATTEMPT` mira si al estudiante le quedan intentos.
  const siblings = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = siblings.get(a.assessmentAssignmentId) ?? [];
    list.push(a);
    siblings.set(a.assessmentAssignmentId, list);
  }

  const attemptRows = attempts.map((a) => {
    const status = a.status as AttemptStatus;
    const policy = a.assessmentVersion.reviewPolicy as ReviewPolicy;
    const accommodation = a.appliedAccommodation as { allowedAttemptsBonus?: number } | null;
    const exhausted = attemptsExhausted({
      attempts: siblings.get(a.assessmentAssignmentId) ?? [],
      attemptsAllowed: a.assessmentVersion.maxAttempts + (accommodation?.allowedAttemptsBonus ?? 0),
      passPercent: a.assessmentVersion.passPercent,
    });
    return {
      id: a.id,
      assignmentId: a.assessmentAssignmentId,
      title: a.assignment.assessment.title,
      moduleName: a.assignment.assessment.module?.name ?? '',
      subjectName: a.assignment.assessment.subject?.name ?? null,
      cohortId: a.assignment.cohort.id,
      cohortCode: a.assignment.cohort.code,
      programName: a.assignment.cohort.program.name,
      number: a.number,
      status,
      submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      score:
        reviewLevel({ policy, status, dueAt: a.assignment.dueAt, now, exhausted }) === 'NONE'
          ? null
          : scoreView(a, a.assessmentVersion.passPercent),
    };
  });

  // Los exámenes de la ruta, cohorte por cohorte activa; la mejor nota visible de cada uno.
  const mine = await listMyEnrollments({ institutionId, personId, now });
  const outlines = await Promise.all(
    mine
      .filter((row) => row.gate === null)
      .map((row) =>
        getCohortOutline({ institutionId, personId, enrollmentId: row.enrollmentId, now })
      )
  );
  // El umbral de cada examen asignado (4/10): la ruta no lo trae y el gráfico de bala lo pinta.
  const thresholds = new Map(
    (
      await createTenantClient(institutionId).assessmentAssignment.findMany({
        where: {
          id: {
            in: outlines.flatMap((o) =>
              o.modules.flatMap((m) =>
                m.items.filter((i) => i.kind === 'ASSESSMENT').map((i) => i.assignmentId)
              )
            ),
          },
        },
        select: { id: true, assessmentVersion: { select: { passPercent: true } } },
      })
    ).map((row) => [row.id, row.assessmentVersion.passPercent])
  );

  const assessmentRows: ResultsForStudent['assessments'] = outlines.flatMap((outline) =>
    outline.modules.flatMap((module) =>
      module.items
        .filter((item) => item.kind === 'ASSESSMENT')
        .map((item) => {
          const visible = attemptRows.filter(
            (a) => a.assignmentId === item.assignmentId && a.score !== null
          );
          const best = visible.reduce<{ percent: number; passed: boolean } | null>(
            (acc, a) =>
              a.score && (acc === null || a.score.percent > acc.percent)
                ? { percent: a.score.percent, passed: a.score.passed }
                : acc,
            null
          );
          return {
            assignmentId: item.assignmentId,
            title: item.title,
            moduleName: module.name,
            subjectName: item.subjectName ?? null,
            cohortId: outline.cohort?.id ?? '',
            cohortCode: outline.cohort?.code ?? '',
            programName: outline.cohort?.programName ?? '',
            fromHistory: false,
            status: item.status,
            enabled: item.enabled,
            blockedBy: item.blockedBy,
            unavailableReason: item.unavailableReason,
            dueAt: item.dueAt ? item.dueAt.toISOString() : null,
            best,
            visibleAttempts: visible.length,
            passPercent: thresholds.get(item.assignmentId) ?? null,
          };
        })
    )
  );

  // Lo que la ruta ya no trae (programa terminado o vencido): el cuestionario sale de sus
  // intentos, con su mejor nota visible (8/10). Antes la página decía «no tienes exámenes».
  const listed = new Set(assessmentRows.map((row) => row.assignmentId));
  for (const a of attempts) {
    if (listed.has(a.assessmentAssignmentId)) continue;
    listed.add(a.assessmentAssignmentId);
    const own = attempts.filter((x) => x.assessmentAssignmentId === a.assessmentAssignmentId);
    const visible = attemptRows.filter(
      (x) => x.assignmentId === a.assessmentAssignmentId && x.score !== null
    );
    const best = visible.reduce<{ percent: number; passed: boolean } | null>(
      (acc, x) =>
        x.score && (acc === null || x.score.percent > acc.percent)
          ? { percent: x.score.percent, passed: x.score.passed }
          : acc,
      null
    );
    const accommodation = a.appliedAccommodation as { allowedAttemptsBonus?: number } | null;
    const row = attemptRows.find((x) => x.id === a.id)!;
    assessmentRows.push({
      assignmentId: a.assessmentAssignmentId,
      title: row.title,
      moduleName: row.moduleName,
      subjectName: row.subjectName,
      cohortId: row.cohortId,
      cohortCode: row.cohortCode,
      programName: row.programName,
      fromHistory: true,
      status: assessmentStatus(own, {
        attemptsAllowed:
          a.assessmentVersion.maxAttempts + (accommodation?.allowedAttemptsBonus ?? 0),
        passPercent: a.assessmentVersion.passPercent,
      }),
      enabled: false,
      blockedBy: null,
      unavailableReason: null,
      dueAt: null,
      best,
      visibleAttempts: visible.length,
      passPercent: a.assessmentVersion.passPercent,
    });
  }

  return {
    assessments: assessmentRows,
    scores: scores.map((s) => ({
      subjectName: s.subject.name,
      cohortId: s.cohort.id,
      cohortCode: s.cohort.code,
      programName: s.cohort.program.name,
      value: s.value.toNumber(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    attempts: attemptRows,
    programs: mine.map((row) => ({
      cohortId: row.cohort.id,
      programName: row.cohort.programName,
      cohortName: row.cohort.name,
      state: row.gate === null ? 'ACTIVE' : row.gate.kind === 'COMPLETED' ? 'COMPLETED' : 'CLOSED',
    })),
  };
}
