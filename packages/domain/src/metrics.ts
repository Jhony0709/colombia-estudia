/**
 * Metrics for reports.
 * SSOT: reference/04-business-logic/reportes.md:11-19
 *
 * All rates are fractions 0–1, not percentages.
 */

import { isPassing } from './grading';

// ─────────────────────────── Types ───────────────────────────

export type DerivedBillingStatus = 'PARTNER_PAID' | 'CURRENT' | 'IN_AGREEMENT' | 'OVERDUE';

export interface ProgressEntry {
  completed: number;
  assigned: number;
}

export interface ProgressResult {
  perEnrollment: number[];
  cohortAverage: number;
}

// ─────────────────────────── Functions ───────────────────────────

/**
 * Tasa de finalización.
 * reportes.md:11 "matrículas COMPLETED / matrículas que alguna vez fueron ACTIVE"
 *
 * @returns Fraction 0–1. Returns 0 if everActiveCount is 0.
 */
export function completionRate(input: { completedCount: number; everActiveCount: number }): number {
  const { completedCount, everActiveCount } = input;
  if (everActiveCount === 0) {
    return 0;
  }
  return completedCount / everActiveCount;
}

/**
 * Avance con evidencia.
 * reportes.md:12 "temas COMPLETED con source = EVIDENCE / temas asignados,
 * por matrícula y promedio de cohorte"
 *
 * @returns perEnrollment: array of fractions 0–1; cohortAverage: mean of those fractions.
 */
export function evidenceProgress(input: { perEnrollment: ProgressEntry[] }): ProgressResult {
  const { perEnrollment } = input;

  const rates = perEnrollment.map((entry) => {
    if (entry.assigned === 0) {
      return 0;
    }
    return entry.completed / entry.assigned;
  });

  const cohortAverage =
    rates.length === 0 ? 0 : rates.reduce((sum, r) => sum + r, 0) / rates.length;

  return {
    perEnrollment: rates,
    cohortAverage,
  };
}

/**
 * Avance importado o manual.
 * reportes.md:13 "temas COMPLETED con source ≠ EVIDENCE (se muestra aparte, nunca sumado)"
 *
 * @returns perEnrollment: array of fractions 0–1; cohortAverage: mean of those fractions.
 */
export function nonEvidenceProgress(input: { perEnrollment: ProgressEntry[] }): ProgressResult {
  // Same calculation as evidenceProgress, but for non-evidence completions
  const { perEnrollment } = input;

  const rates = perEnrollment.map((entry) => {
    if (entry.assigned === 0) {
      return 0;
    }
    return entry.completed / entry.assigned;
  });

  const cohortAverage =
    rates.length === 0 ? 0 : rates.reduce((sum, r) => sum + r, 0) / rates.length;

  return {
    perEnrollment: rates,
    cohortAverage,
  };
}

/**
 * Mediana de días hasta completar.
 * reportes.md:14 "mediana(completedAt − enrolledAt) de las COMPLETED"
 *
 * @returns Median days, or null if no enrollments.
 */
export function medianDaysToComplete(
  enrollments: Array<{ enrolledAt: Date; completedAt: Date }>
): number | null {
  if (enrollments.length === 0) {
    return null;
  }

  const days = enrollments.map((e) => {
    const diffMs = e.completedAt.getTime() - e.enrolledAt.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  });

  days.sort((a, b) => a - b);

  const mid = Math.floor(days.length / 2);

  if (days.length % 2 === 0) {
    // Even count: average of two middle values
    return (days[mid - 1]! + days[mid]!) / 2;
  } else {
    // Odd count: middle value
    return days[mid]!;
  }
}

/**
 * En riesgo.
 * reportes.md:15 "matrículas ACTIVE sin LearningEvent en ≥ 14 días"
 *
 * @returns Array of enrollment IDs that are at risk.
 */
export function atRisk(input: {
  enrollments: Array<{
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';
    lastLearningEventAt: Date | null;
  }>;
  now: Date;
}): string[] {
  const { enrollments, now } = input;
  const RISK_THRESHOLD_DAYS = 14;
  const RISK_THRESHOLD_MS = RISK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  return enrollments
    .filter((e) => {
      if (e.status !== 'ACTIVE') {
        return false;
      }

      // No learning event ever → at risk
      if (e.lastLearningEventAt === null) {
        return true;
      }

      const daysSinceEvent = now.getTime() - e.lastLearningEventAt.getTime();
      // ≥ 14 days = at risk
      return daysSinceEvent >= RISK_THRESHOLD_MS;
    })
    .map((e) => e.id);
}

/**
 * Evaluaciones presentadas / aprobadas.
 * reportes.md:16 "intentos GRADED / matrículas; aprobadas = score/maxScore × 100 ≥ passPercent"
 *
 * Uses isPassing from grading.ts for consistent pass determination.
 *
 * @returns taken: total GRADED attempts, passed: attempts that pass,
 *          takenPerEnrollment: fraction of taken/enrollmentCount.
 */
export function assessmentsTakenAndPassed(input: {
  attempts: Array<{
    status: string;
    score: number;
    maxScore: number;
    passPercent: number | null;
  }>;
  enrollmentCount: number;
}): { taken: number; passed: number; takenPerEnrollment: number } {
  const { attempts, enrollmentCount } = input;

  const gradedAttempts = attempts.filter((a) => a.status === 'GRADED');
  const taken = gradedAttempts.length;

  const passed = gradedAttempts.filter((a) =>
    isPassing({
      score: a.score,
      maxScore: a.maxScore,
      passPercent: a.passPercent,
    })
  ).length;

  const takenPerEnrollment = enrollmentCount === 0 ? 0 : taken / enrollmentCount;

  return { taken, passed, takenPerEnrollment };
}

/**
 * Cartera.
 * reportes.md:17 "% matrículas por estado derivado"
 *
 * @returns Fractions 0–1 for each billing status.
 */
export function billingBreakdown(input: {
  statuses: DerivedBillingStatus[];
}): Record<DerivedBillingStatus, number> {
  const { statuses } = input;
  const total = statuses.length;

  const counts: Record<DerivedBillingStatus, number> = {
    PARTNER_PAID: 0,
    CURRENT: 0,
    IN_AGREEMENT: 0,
    OVERDUE: 0,
  };

  for (const status of statuses) {
    counts[status]++;
  }

  if (total === 0) {
    return {
      PARTNER_PAID: 0,
      CURRENT: 0,
      IN_AGREEMENT: 0,
      OVERDUE: 0,
    };
  }

  return {
    PARTNER_PAID: counts.PARTNER_PAID / total,
    CURRENT: counts.CURRENT / total,
    IN_AGREEMENT: counts.IN_AGREEMENT / total,
    OVERDUE: counts.OVERDUE / total,
  };
}

/**
 * Ajustes aplicados.
 * reportes.md:18 "ajustes vigentes por cohorte y cambios en el periodo, con quién los autorizó"
 *
 * @returns count: current accommodations, byAuthorizer: count per authorizer,
 *          changesInPeriod: number of changes within the specified period.
 */
export function accommodationsApplied(input: {
  current: Array<{ id: string; authorizedById: string }>;
  changes: Array<{ at: Date; byId: string }>;
  period: { from: Date; to: Date };
}): {
  count: number;
  byAuthorizer: Record<string, number>;
  changesInPeriod: number;
} {
  const { current, changes, period } = input;

  // Count current accommodations
  const count = current.length;

  // Count by authorizer
  const byAuthorizer: Record<string, number> = {};
  for (const accommodation of current) {
    const key = accommodation.authorizedById;
    byAuthorizer[key] = (byAuthorizer[key] ?? 0) + 1;
  }

  // Count changes within period
  const changesInPeriod = changes.filter((c) => {
    return c.at >= period.from && c.at <= period.to;
  }).length;

  return { count, byAuthorizer, changesInPeriod };
}
