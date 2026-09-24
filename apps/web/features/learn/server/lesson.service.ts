/**
 * Un tema, visto por el estudiante que lo abre.
 * SSOT: plan/08-aprender-y-evaluar.md:22-33 (§2), reference/01-routing/routes.md:28,
 * reference/02-api/endpoints.md:37.
 *
 * La regla que sostiene todo esto: **quién puede abrir un tema lo decide la misma secuencia
 * que pinta la ruta**, no la URL. `getCohortOutline` ya sabe qué está habilitado y por qué,
 * así que se le pregunta a él. Si el player resolviera la asignación por su cuenta, con
 * progresión `LINEAR` bastaría escribir a mano un id para saltarse el orden del programa —y
 * habría dos reglas de secuencia, que es como se acaba teniendo una rota.
 *
 * Cuesta las consultas de la ruta entera en cada tema. Es el precio de tener una sola regla,
 * y se paga: lo que está en juego es que alguien estudie lo que no le toca.
 */

import 'server-only';

import { renderLessonHtml, parseLessonMarkdown } from '@colombia-estudia/types';
import type { LessonForm } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { resolveRenderAssets } from '@/features/content/server/render-assets';
import { getCohortOutline, type CohortGate, type OutlineModule } from './cohort.service';
import { neighbours } from './outline';
import { readText } from '@/lib/media/storage';
import { parseWebVtt, type Cue } from '@/lib/media/webvtt';
import { lessonFormOf } from './lesson-form';
import { getSubmissionForStudent, type SubmissionView } from './submission.service';

/**
 * Por qué no se puede abrir este tema.
 *
 * `NOT_ASSIGNED` es deliberadamente mudo: cubre "no existe" y "existe pero es de otra
 * cohorte" con la misma respuesta, para no confirmarle a nadie qué ids son reales.
 */
export type LessonGate =
  | { kind: 'COHORT'; cohort: CohortGate }
  | { kind: 'NOT_ASSIGNED' }
  | { kind: 'BLOCKED'; blockedBy: string }
  | { kind: 'NOT_YET' }
  | { kind: 'CLOSED' };

export interface LessonNeighbour {
  assignmentId: string;
  title: string;
  kind: 'LESSON' | 'ASSESSMENT';
  enabled: boolean;
  /** Título del tema que hay que completar antes, cuando la secuencia lo bloquea. */
  blockedBy: string | null;
}

export interface LessonProgressView {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  secondsOnLesson: number;
  scrolledToEnd: boolean;
  videoPositionSeconds: number | null;
  transcriptReadToEnd: boolean;
  completedAt: string | null;
}

export interface LessonTranscript {
  assetId: string;
  vimeoId: string;
  title: string | null;
  cues: Cue[];
}

export interface LessonForStudent {
  gate: LessonGate | null;
  lesson: {
    assignmentId: string;
    /** La matrícula por la que se abre (21/9): «volver a la ruta» vuelve a ESE programa. */
    enrollmentId: string;
    title: string;
    moduleName: string;
    language: string;
    learningObjective: string | null;
    estimatedMinutes: number | null;
    requiresSubmission: boolean;
    /**
     * La actividad (23/9), solo con `requiresSubmission`: las instrucciones ya en HTML
     * saneado (mismo `renderLessonHtml`, sin assets) y qué se acepta como entrega.
     */
    activity: { html: string | null; accepts: 'TEXT' | 'FILE' | 'TEXT_OR_FILE' } | null;
    /** Qué evidencia la completa. `lesson-form.ts` explica por qué se decide así. */
    form: LessonForm;
    /** HTML ya saneado por `renderLessonHtml`: es lo que sostiene el `dangerouslySetInnerHTML`. */
    html: string;
    /** Recursos citados que no se pudieron resolver. Se dicen, no se esconden. */
    missingAssets: string[];
    /**
     * Transcripciones sincronizadas de los videos del tema (WebVTT ya parseado). `vimeoId`
     * casa con el `src` del iframe que pintó el render; `transcript-panel.tsx` los junta.
     */
    transcripts: LessonTranscript[];
  } | null;
  progress: LessonProgressView | null;
  /** La entrega vigente cuando el tema la exige; `null` si no la exige o aún no hay. */
  submission: SubmissionView | null;
  navigation: { previous: LessonNeighbour | null; next: LessonNeighbour | null };
  /** La ruta del programa, para la barra lateral del player (21/9). Vacía si no se abre. */
  route: OutlineModule[];
}

const NO_NAV = { previous: null, next: null };

const blocked = (gate: LessonGate): LessonForStudent => ({
  gate,
  lesson: null,
  progress: null,
  submission: null,
  navigation: NO_NAV,
  route: [],
});

/** El vecino, recortado a lo que la barra de acciones necesita. */
const neighbourView = (
  item: {
    assignmentId: string;
    title: string;
    kind: 'LESSON' | 'ASSESSMENT';
    enabled: boolean;
    blockedBy: string | null;
  } | null
): LessonNeighbour | null =>
  item === null
    ? null
    : {
        assignmentId: item.assignmentId,
        title: item.title,
        kind: item.kind,
        enabled: item.enabled,
        blockedBy: item.blockedBy,
      };

/**
 * La evidencia guardada, con valores por defecto.
 *
 * `evidence` es `Json` en el schema, así que lo que vuelve de la base no está tipado: se lee
 * campo a campo y se descarta lo que no tenga la forma esperada. Una fila escrita por una
 * versión anterior del player no puede hacer reventar la pantalla.
 */
function progressView(
  row: {
    status: string;
    evidence: unknown;
    completedAt: Date | null;
  } | null
): LessonProgressView | null {
  if (!row) return null;

  const evidence = (
    typeof row.evidence === 'object' && row.evidence !== null ? row.evidence : {}
  ) as Record<string, unknown>;

  const numberOr = (value: unknown, fallback: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    status:
      row.status === 'COMPLETED'
        ? 'COMPLETED'
        : row.status === 'IN_PROGRESS'
          ? 'IN_PROGRESS'
          : 'NOT_STARTED',
    secondsOnLesson: numberOr(evidence.secondsOnLesson, 0) ?? 0,
    scrolledToEnd: evidence.scrolledToEnd === true,
    videoPositionSeconds: numberOr(evidence.videoPositionSeconds, null),
    transcriptReadToEnd: evidence.transcriptReadToEnd === true,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export async function getLessonForStudent({
  institutionId,
  personId,
  assignmentId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  now?: Date;
}): Promise<LessonForStudent> {
  const outline = await getCohortOutline({ institutionId, personId, assignmentId, now });

  // Los estados terminales de la cohorte mandan sobre todo lo demás: con el acceso vencido
  // no hay tema que valga.
  if (outline.gate || !outline.cohort || !outline.enrollmentId) {
    return blocked({ kind: 'COHORT', cohort: outline.gate ?? { kind: 'NO_ENROLLMENT' } });
  }

  const ordered = outline.modules.flatMap((module) => module.items);
  const item = ordered.find((candidate) => candidate.assignmentId === assignmentId);

  if (!item || item.kind !== 'LESSON') return blocked({ kind: 'NOT_ASSIGNED' });

  if (!item.enabled) {
    return blocked(
      item.blockedBy
        ? { kind: 'BLOCKED', blockedBy: item.blockedBy }
        : item.unavailableReason === 'NOT_YET'
          ? { kind: 'NOT_YET' }
          : { kind: 'CLOSED' }
    );
  }

  const db = createTenantClient(institutionId);

  // `cohortId` en el `where` aunque la ruta ya lo probó: una consulta no se apoya en que
  // quien la llama hizo bien su parte.
  const assignment = await db.lessonAssignment.findFirst({
    where: { id: assignmentId, cohortId: outline.cohort.id },
    select: {
      id: true,
      lesson: {
        select: {
          title: true,
          language: true,
          learningObjective: true,
          requiresSubmission: true,
          activityInstructions: true,
          activityAccepts: true,
          module: { select: { name: true } },
        },
      },
      // La versión **asignada**, no la última publicada: `LessonAssignment.lessonVersionId`
      // la congela, y por eso publicar un tema no le cambia el contenido bajo los pies a
      // quien lo está estudiando.
      lessonVersion: { select: { content: true, estimatedMinutes: true } },
    },
  });

  if (!assignment) return blocked({ kind: 'NOT_ASSIGNED' });

  const progressRow = await db.lessonProgress.findFirst({
    where: { enrollmentId: outline.enrollmentId, lessonAssignmentId: assignmentId },
    select: { status: true, evidence: true, completedAt: true },
  });

  const { content } = assignment.lessonVersion;
  const parsed = parseLessonMarkdown(content);
  const assetIds = [...new Set(parsed.assets.map((asset) => asset.id))];
  const assets = await resolveRenderAssets({ institutionId, assetIds });

  const { previous, next } = neighbours(ordered, assignmentId);
  const transcripts = await loadTranscripts({ institutionId, assetIds: [...assets.keys()] });

  // Solo se consulta cuando el tema la exige: en los demás no hay fila que buscar.
  const submission = assignment.lesson.requiresSubmission
    ? await getSubmissionForStudent({
        institutionId,
        enrollmentId: outline.enrollmentId,
        assignmentId,
      })
    : null;

  return {
    gate: null,
    lesson: {
      assignmentId,
      enrollmentId: outline.enrollmentId,
      title: assignment.lesson.title,
      moduleName: assignment.lesson.module.name,
      language: assignment.lesson.language,
      learningObjective: assignment.lesson.learningObjective,
      estimatedMinutes: assignment.lessonVersion.estimatedMinutes,
      requiresSubmission: assignment.lesson.requiresSubmission,
      // Las instrucciones son del tema, no de la versión: lo que el autor corrija se ve aquí
      // al momento (decisión del 23/9).
      activity: assignment.lesson.requiresSubmission
        ? {
            html: assignment.lesson.activityInstructions
              ? renderLessonHtml(assignment.lesson.activityInstructions, new Map(), {
                  language: assignment.lesson.language,
                })
              : null,
            accepts: assignment.lesson.activityAccepts,
          }
        : null,
      form: lessonFormOf({ parsed, requiresSubmission: assignment.lesson.requiresSubmission }),
      html: renderLessonHtml(content, assets, { language: assignment.lesson.language }),
      missingAssets: assetIds.filter((id) => !assets.has(id)),
      transcripts,
    },
    progress: progressView(progressRow),
    submission,
    navigation: { previous: neighbourView(previous), next: neighbourView(next) },
    route: outline.modules,
  };
}

/**
 * Las transcripciones WebVTT de los videos resueltos, leídas de Storage y parseadas.
 * Un archivo que no se pueda leer deja el video sin transcripción, no la página sin tema.
 */
async function loadTranscripts({
  institutionId,
  assetIds,
}: {
  institutionId: string;
  assetIds: string[];
}): Promise<LessonTranscript[]> {
  if (assetIds.length === 0) return [];
  const db = createTenantClient(institutionId);
  const videos = await db.mediaAsset.findMany({
    where: {
      id: { in: assetIds },
      kind: 'VIDEO',
      provider: 'VIMEO',
      transcriptPath: { not: null },
    },
    select: { id: true, providerRef: true, altText: true, transcriptPath: true },
  });
  const out: LessonTranscript[] = [];
  for (const v of videos) {
    const text = v.transcriptPath ? await readText(v.transcriptPath).catch(() => null) : null;
    if (!text) continue;
    const cues = parseWebVtt(text);
    if (cues.length === 0) continue;
    out.push({ assetId: v.id, vimeoId: v.providerRef, title: v.altText, cues });
  }
  return out;
}
