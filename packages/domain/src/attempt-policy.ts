/**
 * Attempt deadline and attempts allowed calculation.
 * SSOT: reference/04-business-logic/ajustes-razonables.md
 *
 * Formula from contenido-y-evaluaciones.md §Evaluaciones:
 * deadline = min(
 *   startedAt + timeLimitMinutes × extraTimeFactor (or ∞ if exemptFromTimer),
 *   assignment.dueAt,
 *   enrollment.accessUntil
 * )
 *
 * attemptsAllowed = maxAttempts + allowedAttemptsBonus
 */

import { endOfBogotaDay } from './dates';
import type { Accommodation, AssessmentAssignment, AssessmentVersion, Enrollment } from './types';

// ─────────────────────────── Types ───────────────────────────

export interface GetAttemptDeadlineInput {
  assessmentVersion: AssessmentVersion;
  assignment: AssessmentAssignment;
  enrollment: Enrollment;
  accommodation: Accommodation | null;
  startedAt: Date;
}

export interface GetAttemptsAllowedInput {
  assessmentVersion: AssessmentVersion;
  accommodation: Accommodation | null;
}

// ─────────────────────────── Main Functions ───────────────────────────

/**
 * Calculate the deadline for an attempt.
 *
 * Returns null if there is no deadline (infinite time allowed).
 *
 * From ajustes-razonables.md:44-47 and contenido-y-evaluaciones.md:
 * - If exemptFromTimer: ignore time limit, but dueAt and accessUntil still apply
 * - extraTimeFactor multiplies the time limit (default 1)
 * - timeLimitMinutes = null means no time limit
 * - deadline is the minimum of all applicable limits
 */
export function getAttemptDeadline(input: GetAttemptDeadlineInput): Date | null {
  const { assessmentVersion, assignment, enrollment, accommodation, startedAt } = input;

  // Get accommodation values with defaults
  const extraTimeFactor = accommodation?.extraTimeFactor ?? 1;
  const exemptFromTimer = accommodation?.exemptFromTimer ?? false;

  // Collect all possible deadlines
  const deadlines: Date[] = [];

  // Time limit deadline (if applicable)
  const timeLimitMinutes = assessmentVersion.timeLimitMinutes;
  if (timeLimitMinutes !== null && !exemptFromTimer) {
    const adjustedMinutes = timeLimitMinutes * extraTimeFactor;
    const timeLimitDeadline = new Date(startedAt.getTime() + adjustedMinutes * 60 * 1000);
    deadlines.push(timeLimitDeadline);
  }

  // Assignment due date
  if (assignment.dueAt !== null) {
    deadlines.push(assignment.dueAt);
  }

  // Enrollment access until
  // accessUntil is valid for the entire day in Bogota
  // accessUntil is never null per schema
  deadlines.push(endOfBogotaDay(enrollment.accessUntil));

  // If no deadlines, return null (unlimited time)
  if (deadlines.length === 0) {
    return null;
  }

  // Return the minimum deadline
  return deadlines.reduce((min, d) => (d < min ? d : min));
}

/**
 * Calculate the number of attempts allowed.
 *
 * From ajustes-razonables.md:
 * attemptsAllowed = maxAttempts + allowedAttemptsBonus
 *
 * If accommodation is null, bonus is 0.
 */
export function getAttemptsAllowed(input: GetAttemptsAllowedInput): number {
  const { assessmentVersion, accommodation } = input;

  const maxAttempts = assessmentVersion.maxAttempts;
  const bonus = accommodation?.allowedAttemptsBonus ?? 0;

  return maxAttempts + bonus;
}
