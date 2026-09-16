/**
 * Enrollment completion and unlock state logic.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:33-42
 *
 * LINEAR/FREE progression.
 * DIAGNOSTIC doesn't count for approval but blocks first theme until GRADED.
 */

import { isPassing } from './grading';

// ─────────────────────────── Types ───────────────────────────

export type Progression = 'LINEAR' | 'FREE';
export type AssessmentKind = 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED';
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface LessonInput {
  id: string;
  position: number;
  title: string;
  progressStatus: ProgressStatus;
}

export interface AssessmentInput {
  id: string;
  position: number;
  title: string;
  kind: AssessmentKind;
  passPercent: number | null;
  attemptsAllowed: number;
  attempts: Array<{
    status: AttemptStatus;
    score: number;
    maxScore: number;
  }>;
}

export interface ModuleInput {
  id: string;
  position: number;
  name: string;
  lessons: LessonInput[];
  assessments: AssessmentInput[];
}

export type UnlockState =
  | { unlocked: true }
  | {
      unlocked: false;
      blockedBy: {
        kind: 'lesson' | 'assessment' | 'module';
        id: string;
        title: string;
      };
    };

// ─────────────────────────── Helpers ───────────────────────────

/**
 * Check if an assessment has at least one passing GRADED attempt.
 * SSOT: contenido-y-evaluaciones.md:40-42 (aprobar = score/maxScore × 100 ≥ passPercent,
 * o cualquier GRADED si passPercent es nulo).
 */
function isAssessmentPassed(assessment: AssessmentInput): boolean {
  const { attempts, passPercent } = assessment;
  return attempts.some(
    (attempt) =>
      attempt.status === 'GRADED' &&
      isPassing({ score: attempt.score, maxScore: attempt.maxScore, passPercent })
  );
}

/**
 * Check if an assessment is passed OR has exhausted its attempts.
 * Used ONLY for unlocking the next module (contenido-y-evaluaciones.md:35),
 * never for completing the enrollment (:40-42).
 *
 * // AMBIGUO(contenido-y-evaluaciones.md:35): "agotar intentos" cuenta todo intento que ya
 * // no está IN_PROGRESS (GRADED, SUBMITTED, EXPIRED): el número de intento se consumió.
 */
function isAssessmentPassedOrExhausted(assessment: AssessmentInput): boolean {
  if (isAssessmentPassed(assessment)) {
    return true;
  }

  const usedCount = assessment.attempts.filter((a) => a.status !== 'IN_PROGRESS').length;
  return usedCount >= assessment.attemptsAllowed;
}

/**
 * Modules, lessons and assessments are ordered by `position` (schema: @@unique([programId, position])).
 * The caller is not required to pre-sort.
 */
function byPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/**
 * Check if a DIAGNOSTIC has at least one GRADED attempt.
 */
function isDiagnosticAttempted(assessment: AssessmentInput): boolean {
  return assessment.attempts.some((a) => a.status === 'GRADED');
}

/**
 * Check if all lessons in a module are completed.
 */
function areAllLessonsCompleted(lessons: LessonInput[]): boolean {
  return lessons.every((l) => l.progressStatus === 'COMPLETED');
}

// ─────────────────────────── Main Functions ───────────────────────────

/**
 * Determines if an enrollment is completed.
 * SSOT: contenido-y-evaluaciones.md:40-42
 *
 * All lesson assignments COMPLETED + all SUBJECT/FINAL assessments passed.
 * DIAGNOSTIC never counts for approval.
 */
export function isEnrollmentCompleted(input: {
  progression: Progression;
  modules: ModuleInput[];
  programAssessments?: AssessmentInput[];
}): boolean {
  const { modules, programAssessments = [] } = input;

  // Check all lessons are completed
  for (const module of modules) {
    for (const lesson of module.lessons) {
      if (lesson.progressStatus !== 'COMPLETED') {
        return false;
      }
    }
  }

  // Check all SUBJECT/FINAL assessments are PASSED (DIAGNOSTIC doesn't count).
  // Exhausting attempts unlocks the next module (:35) but never completes the
  // enrollment (:40-42): a student who failed every attempt is not COMPLETED and
  // gets no PROGRAM certificate.
  const allAssessments = [...programAssessments, ...modules.flatMap((m) => m.assessments)];

  for (const assessment of allAssessments) {
    if (assessment.kind === 'DIAGNOSTIC') {
      continue; // DIAGNOSTIC never counts for completion
    }

    if (!isAssessmentPassed(assessment)) {
      return false;
    }
  }

  return true;
}

/**
 * Determines unlock state for all lessons and assessments.
 * SSOT: contenido-y-evaluaciones.md:33-38
 *
 * Rules LINEAR:
 * 1. Tema N tras N-1 completo
 * 2. SUBJECT del módulo tras TODOS sus temas
 *    // AMBIGUO(contenido-y-evaluaciones.md:34): "sus temas" = todos los del módulo
 * 3. Módulo siguiente tras aprobar o agotar intentos de evaluaciones del anterior
 * 4. DIAGNOSTIC obligatoria antes del primer tema y nunca cuenta
 * 5. FREE: todo abierto
 */
export function getUnlockState(input: {
  progression: Progression;
  modules: ModuleInput[];
  programAssessments?: AssessmentInput[];
}): Map<string, UnlockState> {
  const { progression, programAssessments = [] } = input;
  const modules = byPosition(input.modules);
  const result = new Map<string, UnlockState>();

  // FREE: everything is unlocked
  if (progression === 'FREE') {
    for (const module of modules) {
      for (const lesson of module.lessons) {
        result.set(lesson.id, { unlocked: true });
      }
      for (const assessment of module.assessments) {
        result.set(assessment.id, { unlocked: true });
      }
    }
    for (const assessment of programAssessments) {
      result.set(assessment.id, { unlocked: true });
    }
    return result;
  }

  // LINEAR progression
  let previousModuleCompleted = true;

  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
    const module = modules[moduleIndex]!;
    const sortedLessons = byPosition(module.lessons);
    const sortedAssessments = byPosition(module.assessments);

    // Find DIAGNOSTIC for this module or program (first module only)
    let diagnostic: AssessmentInput | null = null;
    if (moduleIndex === 0) {
      // Check program-level DIAGNOSTIC
      diagnostic = programAssessments.find((a) => a.kind === 'DIAGNOSTIC') ?? null;
    }
    if (!diagnostic) {
      // Check module-level DIAGNOSTIC
      diagnostic = sortedAssessments.find((a) => a.kind === 'DIAGNOSTIC') ?? null;
    }

    // Check if previous module's assessments are done
    if (!previousModuleCompleted) {
      // Block entire module
      const previousModule = modules[moduleIndex - 1]!;
      for (const lesson of module.lessons) {
        result.set(lesson.id, {
          unlocked: false,
          blockedBy: { kind: 'module', id: previousModule.id, title: previousModule.name },
        });
      }
      for (const assessment of module.assessments) {
        result.set(assessment.id, {
          unlocked: false,
          blockedBy: { kind: 'module', id: previousModule.id, title: previousModule.name },
        });
      }
      continue;
    }

    // Process lessons
    for (let lessonIndex = 0; lessonIndex < sortedLessons.length; lessonIndex++) {
      const lesson = sortedLessons[lessonIndex]!;

      if (lessonIndex === 0) {
        // First lesson: blocked by DIAGNOSTIC if exists and not GRADED
        if (diagnostic && !isDiagnosticAttempted(diagnostic)) {
          result.set(lesson.id, {
            unlocked: false,
            blockedBy: { kind: 'assessment', id: diagnostic.id, title: diagnostic.title },
          });
        } else {
          result.set(lesson.id, { unlocked: true });
        }
      } else {
        // Later lessons: blocked by previous lesson
        const previousLesson = sortedLessons[lessonIndex - 1]!;
        if (previousLesson.progressStatus === 'COMPLETED') {
          result.set(lesson.id, { unlocked: true });
        } else {
          result.set(lesson.id, {
            unlocked: false,
            blockedBy: { kind: 'lesson', id: previousLesson.id, title: previousLesson.title },
          });
        }
      }
    }

    // Process assessments (DIAGNOSTIC is always unlocked first)
    const allModuleLessonsCompleted = areAllLessonsCompleted(sortedLessons);

    for (const assessment of sortedAssessments) {
      if (assessment.kind === 'DIAGNOSTIC') {
        // DIAGNOSTIC is always unlocked
        result.set(assessment.id, { unlocked: true });
      } else {
        // SUBJECT/FINAL blocked until all module lessons completed
        // AMBIGUO(contenido-y-evaluaciones.md:34): "sus temas" = todos los del módulo
        if (allModuleLessonsCompleted) {
          result.set(assessment.id, { unlocked: true });
        } else {
          // Find first incomplete lesson
          const incompleteLesson = sortedLessons.find((l) => l.progressStatus !== 'COMPLETED');
          if (incompleteLesson) {
            result.set(assessment.id, {
              unlocked: false,
              blockedBy: { kind: 'lesson', id: incompleteLesson.id, title: incompleteLesson.title },
            });
          }
        }
      }
    }

    // Check if this module's assessments are done for next module
    const moduleAssessmentsExceptDiagnostic = sortedAssessments.filter(
      (a) => a.kind !== 'DIAGNOSTIC'
    );
    previousModuleCompleted =
      allModuleLessonsCompleted &&
      moduleAssessmentsExceptDiagnostic.every(isAssessmentPassedOrExhausted);
  }

  // Process program-level assessments (always unlocked for DIAGNOSTIC)
  for (const assessment of programAssessments) {
    if (assessment.kind === 'DIAGNOSTIC') {
      result.set(assessment.id, { unlocked: true });
    } else {
      // Program-level SUBJECT/FINAL need all modules done
      const allDone = modules.every(
        (m) =>
          areAllLessonsCompleted(m.lessons) &&
          m.assessments.filter((a) => a.kind !== 'DIAGNOSTIC').every(isAssessmentPassedOrExhausted)
      );
      if (allDone) {
        result.set(assessment.id, { unlocked: true });
      } else {
        // Find first incomplete module
        const incompleteModule = modules.find(
          (m) =>
            !areAllLessonsCompleted(m.lessons) ||
            !m.assessments
              .filter((a) => a.kind !== 'DIAGNOSTIC')
              .every(isAssessmentPassedOrExhausted)
        );
        if (incompleteModule) {
          result.set(assessment.id, {
            unlocked: false,
            blockedBy: { kind: 'module', id: incompleteModule.id, title: incompleteModule.name },
          });
        }
      }
    }
  }

  return result;
}
