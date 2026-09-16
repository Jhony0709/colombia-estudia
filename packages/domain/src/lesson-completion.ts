/**
 * Lesson completion logic.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:145-150
 *
 * Evidence table by content form.
 * requiresSubmission (SUBMISSION form) only completes with Submission APPROVED.
 *
 * Note: source MANUAL/IMPORTED does not pass through here (contenido-y-evaluaciones.md:152-153).
 * Those are written directly by operations or the importer.
 */

// ─────────────────────────── Types ───────────────────────────

export type LessonForm = 'VIDEO' | 'MARKDOWN' | 'LEGACY' | 'SUBMISSION';

export type SubmissionStatus = 'SUBMITTED' | 'RETURNED' | 'APPROVED';

/**
 * Evidence shape from schema:689-693
 */
export interface LessonEvidence {
  videoPositionSeconds?: number;
  transcriptReadToEnd?: boolean;
  scrolledToEnd?: boolean;
  secondsOnLesson?: number;
}

export interface IsLessonCompletedInput {
  form: LessonForm;
  evidence: LessonEvidence;
  videoDurationSeconds: number | null;
  estimatedMinutes: number | null;
  submissionStatus: SubmissionStatus | null;
}

// ─────────────────────────── Main Function ───────────────────────────

/**
 * Determines if a lesson is completed based on its form and evidence.
 *
 * SSOT: contenido-y-evaluaciones.md:145-150
 *
 * | Forma | Evidencia de completado |
 * |-------|-------------------------|
 * | VIDEO | posición ≥ 90 % O transcripción leída hasta el final |
 * | MARKDOWN | scroll al final Y tiempo ≥ min(estimatedMinutes × 0.5, 2 min) |
 * | LEGACY | igual que MARKDOWN (// AMBIGUO(:149)) |
 * | SUBMISSION | Submission con estado APPROVED |
 */
export function isLessonCompleted(input: IsLessonCompletedInput): boolean {
  const { form, evidence, videoDurationSeconds, estimatedMinutes, submissionStatus } = input;

  switch (form) {
    case 'VIDEO':
      return isVideoCompleted(evidence, videoDurationSeconds);

    case 'MARKDOWN':
      return isMarkdownCompleted(evidence, estimatedMinutes);

    case 'LEGACY':
      // AMBIGUO(contenido-y-evaluaciones.md:149): igual que MARKDOWN
      return isMarkdownCompleted(evidence, estimatedMinutes);

    case 'SUBMISSION':
      return submissionStatus === 'APPROVED';
  }
}

/**
 * VIDEO completion: position ≥ 90% OR transcriptReadToEnd
 *
 * // AMBIGUO(contenido-y-evaluaciones.md:147): if videoDurationSeconds is null,
 * only transcriptReadToEnd can complete
 */
function isVideoCompleted(evidence: LessonEvidence, videoDurationSeconds: number | null): boolean {
  // Transcript read to end always completes
  if (evidence.transcriptReadToEnd === true) {
    return true;
  }

  // AMBIGUO(:147): if videoDurationSeconds is null, only transcriptReadToEnd completes
  if (videoDurationSeconds === null || videoDurationSeconds <= 0) {
    return false;
  }

  // Check position >= 90%
  const position = evidence.videoPositionSeconds ?? 0;
  const requiredPosition = videoDurationSeconds * 0.9;

  return position >= requiredPosition;
}

/**
 * MARKDOWN completion: scrolledToEnd AND time >= min(estimatedMinutes * 30, 120)
 *
 * // AMBIGUO(contenido-y-evaluaciones.md:148): estimatedMinutes null → 120s minimum
 */
function isMarkdownCompleted(evidence: LessonEvidence, estimatedMinutes: number | null): boolean {
  // Must have scrolled to end
  if (evidence.scrolledToEnd !== true) {
    return false;
  }

  // Calculate required seconds
  // estimatedMinutes * 0.5 min = estimatedMinutes * 30 seconds
  // Cap at 120 seconds (2 minutes)
  // AMBIGUO(:148): estimatedMinutes null → 120s minimum
  const requiredSeconds = estimatedMinutes !== null ? Math.min(estimatedMinutes * 30, 120) : 120;

  const actualSeconds = evidence.secondsOnLesson ?? 0;

  return actualSeconds >= requiredSeconds;
}
