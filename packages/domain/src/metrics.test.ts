/**
 * Tests for metrics.ts
 * SSOT: reference/04-business-logic/reportes.md:11-19
 */

import {
  completionRate,
  evidenceProgress,
  nonEvidenceProgress,
  medianDaysToComplete,
  atRisk,
  assessmentsTakenAndPassed,
  billingBreakdown,
  accommodationsApplied,
} from './metrics';

// ─────────────────────────── completionRate ───────────────────────────

describe('completionRate', () => {
  it('returns fraction of completed / ever active', () => {
    const result = completionRate({ completedCount: 30, everActiveCount: 100 });
    expect(result).toBe(0.3);
  });

  it('returns 0 if everActiveCount is 0', () => {
    const result = completionRate({ completedCount: 0, everActiveCount: 0 });
    expect(result).toBe(0);
  });

  it('returns 1 if all completed', () => {
    const result = completionRate({ completedCount: 50, everActiveCount: 50 });
    expect(result).toBe(1);
  });
});

// ─────────────────────────── evidenceProgress ───────────────────────────

describe('evidenceProgress', () => {
  it('returns per enrollment rates and cohort average', () => {
    const result = evidenceProgress({
      perEnrollment: [
        { completed: 5, assigned: 10 },
        { completed: 8, assigned: 10 },
        { completed: 10, assigned: 10 },
      ],
    });

    expect(result.perEnrollment).toEqual([0.5, 0.8, 1]);
    // Average: (0.5 + 0.8 + 1) / 3 = 2.3 / 3 ≈ 0.7666...
    expect(result.cohortAverage).toBeCloseTo(0.7667, 3);
  });

  it('handles assigned = 0 as rate 0', () => {
    const result = evidenceProgress({
      perEnrollment: [{ completed: 0, assigned: 0 }],
    });

    expect(result.perEnrollment).toEqual([0]);
    expect(result.cohortAverage).toBe(0);
  });

  it('returns 0 cohortAverage for empty array', () => {
    const result = evidenceProgress({ perEnrollment: [] });

    expect(result.perEnrollment).toEqual([]);
    expect(result.cohortAverage).toBe(0);
  });
});

// ─────────────────────────── nonEvidenceProgress ───────────────────────────

describe('nonEvidenceProgress', () => {
  it('avance manual/importado no se suma (función separada)', () => {
    // The key point: evidence and non-evidence are separate functions
    // They never get summed together
    const evidenceResult = evidenceProgress({
      perEnrollment: [{ completed: 3, assigned: 10 }],
    });

    const nonEvidenceResult = nonEvidenceProgress({
      perEnrollment: [{ completed: 2, assigned: 10 }],
    });

    expect(evidenceResult.perEnrollment[0]).toBe(0.3);
    expect(nonEvidenceResult.perEnrollment[0]).toBe(0.2);
    // These are separate, never combined
  });

  it('same calculation as evidenceProgress', () => {
    const result = nonEvidenceProgress({
      perEnrollment: [
        { completed: 2, assigned: 10 },
        { completed: 4, assigned: 10 },
      ],
    });

    expect(result.perEnrollment).toEqual([0.2, 0.4]);
    expect(result.cohortAverage).toBeCloseTo(0.3, 5);
  });
});

// ─────────────────────────── medianDaysToComplete ───────────────────────────

describe('medianDaysToComplete', () => {
  it('returns null for empty array', () => {
    const result = medianDaysToComplete([]);
    expect(result).toBeNull();
  });

  it('returns single value for one enrollment', () => {
    const result = medianDaysToComplete([
      {
        enrolledAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-11'), // 10 days
      },
    ]);

    expect(result).toBe(10);
  });

  it('mediana con n impar', () => {
    const result = medianDaysToComplete([
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-06') }, // 5 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-11') }, // 10 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-16') }, // 15 days
    ]);

    expect(result).toBe(10); // Middle value
  });

  it('mediana con n par', () => {
    // With even count, median is average of two middle values
    const result = medianDaysToComplete([
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-06') }, // 5 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-11') }, // 10 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-16') }, // 15 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-21') }, // 20 days
    ]);

    // Sorted: [5, 10, 15, 20], median = (10 + 15) / 2 = 12.5
    expect(result).toBe(12.5);
  });

  it('handles unsorted input', () => {
    const result = medianDaysToComplete([
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-21') }, // 20 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-06') }, // 5 days
      { enrolledAt: new Date('2024-01-01'), completedAt: new Date('2024-01-11') }, // 10 days
    ]);

    expect(result).toBe(10); // Sorted: [5, 10, 20], median = 10
  });
});

// ─────────────────────────── atRisk ───────────────────────────

describe('atRisk', () => {
  const NOW = new Date('2024-01-15T12:00:00Z');
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('returns ACTIVE enrollments with no learning event', () => {
    const result = atRisk({
      enrollments: [
        { id: 'e1', status: 'ACTIVE', lastLearningEventAt: null },
        { id: 'e2', status: 'ACTIVE', lastLearningEventAt: new Date('2024-01-14') },
      ],
      now: NOW,
    });

    expect(result).toContain('e1');
    expect(result).not.toContain('e2');
  });

  it('returns ACTIVE enrollments with event ≥ 14 days ago', () => {
    const fourteenDaysAgo = new Date(NOW.getTime() - 14 * DAY_MS);
    const fifteenDaysAgo = new Date(NOW.getTime() - 15 * DAY_MS);

    const result = atRisk({
      enrollments: [
        { id: 'e1', status: 'ACTIVE', lastLearningEventAt: fourteenDaysAgo },
        { id: 'e2', status: 'ACTIVE', lastLearningEventAt: fifteenDaysAgo },
      ],
      now: NOW,
    });

    expect(result).toContain('e1');
    expect(result).toContain('e2');
  });

  it('en riesgo con exactamente 14 días', () => {
    // Exactly 14 days = at risk (≥ 14)
    const exactlyFourteenDays = new Date(NOW.getTime() - 14 * DAY_MS);

    const result = atRisk({
      enrollments: [{ id: 'e1', status: 'ACTIVE', lastLearningEventAt: exactlyFourteenDays }],
      now: NOW,
    });

    expect(result).toEqual(['e1']);
  });

  it('NOT at risk with 13 days 23 hours', () => {
    // Just under 14 days = not at risk
    const almostFourteenDays = new Date(NOW.getTime() - (14 * DAY_MS - 60 * 60 * 1000));

    const result = atRisk({
      enrollments: [{ id: 'e1', status: 'ACTIVE', lastLearningEventAt: almostFourteenDays }],
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it('ignores COMPLETED and WITHDRAWN', () => {
    const twentyDaysAgo = new Date(NOW.getTime() - 20 * DAY_MS);

    const result = atRisk({
      enrollments: [
        { id: 'e1', status: 'COMPLETED', lastLearningEventAt: twentyDaysAgo },
        { id: 'e2', status: 'WITHDRAWN', lastLearningEventAt: null },
        { id: 'e3', status: 'ACTIVE', lastLearningEventAt: twentyDaysAgo },
      ],
      now: NOW,
    });

    expect(result).toEqual(['e3']);
  });
});

// ─────────────────────────── assessmentsTakenAndPassed ───────────────────────────

describe('assessmentsTakenAndPassed', () => {
  it('counts only GRADED attempts', () => {
    const result = assessmentsTakenAndPassed({
      attempts: [
        { status: 'GRADED', score: 70, maxScore: 100, passPercent: 60 },
        { status: 'IN_PROGRESS', score: 0, maxScore: 100, passPercent: 60 },
        { status: 'SUBMITTED', score: 50, maxScore: 100, passPercent: 60 },
        { status: 'GRADED', score: 50, maxScore: 100, passPercent: 60 },
      ],
      enrollmentCount: 10,
    });

    expect(result.taken).toBe(2);
  });

  it('uses isPassing from grading.ts', () => {
    const result = assessmentsTakenAndPassed({
      attempts: [
        { status: 'GRADED', score: 70, maxScore: 100, passPercent: 60 }, // Pass
        { status: 'GRADED', score: 50, maxScore: 100, passPercent: 60 }, // Fail
        { status: 'GRADED', score: 60, maxScore: 100, passPercent: 60 }, // Pass (exact)
      ],
      enrollmentCount: 10,
    });

    expect(result.taken).toBe(3);
    expect(result.passed).toBe(2);
  });

  it('passPercent null means any GRADED passes', () => {
    const result = assessmentsTakenAndPassed({
      attempts: [
        { status: 'GRADED', score: 0, maxScore: 100, passPercent: null },
        { status: 'GRADED', score: 50, maxScore: 100, passPercent: null },
      ],
      enrollmentCount: 5,
    });

    expect(result.taken).toBe(2);
    expect(result.passed).toBe(2);
  });

  it('calculates takenPerEnrollment as fraction', () => {
    const result = assessmentsTakenAndPassed({
      attempts: [
        { status: 'GRADED', score: 70, maxScore: 100, passPercent: 60 },
        { status: 'GRADED', score: 80, maxScore: 100, passPercent: 60 },
        { status: 'GRADED', score: 90, maxScore: 100, passPercent: 60 },
      ],
      enrollmentCount: 10,
    });

    expect(result.takenPerEnrollment).toBe(0.3); // 3/10
  });

  it('handles enrollmentCount 0', () => {
    const result = assessmentsTakenAndPassed({
      attempts: [{ status: 'GRADED', score: 70, maxScore: 100, passPercent: 60 }],
      enrollmentCount: 0,
    });

    expect(result.takenPerEnrollment).toBe(0);
  });
});

// ─────────────────────────── billingBreakdown ───────────────────────────

describe('billingBreakdown', () => {
  it('returns fractions for each status', () => {
    const result = billingBreakdown({
      statuses: ['CURRENT', 'CURRENT', 'OVERDUE', 'PARTNER_PAID'],
    });

    expect(result.CURRENT).toBe(0.5); // 2/4
    expect(result.OVERDUE).toBe(0.25); // 1/4
    expect(result.PARTNER_PAID).toBe(0.25); // 1/4
    expect(result.IN_AGREEMENT).toBe(0); // 0/4
  });

  it('handles empty array', () => {
    const result = billingBreakdown({ statuses: [] });

    expect(result.CURRENT).toBe(0);
    expect(result.OVERDUE).toBe(0);
    expect(result.PARTNER_PAID).toBe(0);
    expect(result.IN_AGREEMENT).toBe(0);
  });

  it('all same status', () => {
    const result = billingBreakdown({
      statuses: ['IN_AGREEMENT', 'IN_AGREEMENT', 'IN_AGREEMENT'],
    });

    expect(result.IN_AGREEMENT).toBe(1);
    expect(result.CURRENT).toBe(0);
    expect(result.OVERDUE).toBe(0);
    expect(result.PARTNER_PAID).toBe(0);
  });
});

// ─────────────────────────── accommodationsApplied ───────────────────────────

describe('accommodationsApplied', () => {
  it('counts current accommodations', () => {
    const result = accommodationsApplied({
      current: [
        { id: 'acc1', authorizedById: 'user1' },
        { id: 'acc2', authorizedById: 'user1' },
        { id: 'acc3', authorizedById: 'user2' },
      ],
      changes: [],
      period: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
    });

    expect(result.count).toBe(3);
  });

  it('groups by authorizer', () => {
    const result = accommodationsApplied({
      current: [
        { id: 'acc1', authorizedById: 'user1' },
        { id: 'acc2', authorizedById: 'user1' },
        { id: 'acc3', authorizedById: 'user2' },
      ],
      changes: [],
      period: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
    });

    expect(result.byAuthorizer).toEqual({ user1: 2, user2: 1 });
  });

  it('counts changes within period', () => {
    const result = accommodationsApplied({
      current: [],
      changes: [
        { at: new Date('2024-01-05'), byId: 'user1' },
        { at: new Date('2024-01-15'), byId: 'user2' },
        { at: new Date('2024-02-01'), byId: 'user1' }, // Outside period
        { at: new Date('2023-12-31'), byId: 'user1' }, // Outside period
      ],
      period: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
    });

    expect(result.changesInPeriod).toBe(2);
  });

  it('includes changes on period boundaries', () => {
    const result = accommodationsApplied({
      current: [],
      changes: [
        { at: new Date('2024-01-01T00:00:00Z'), byId: 'user1' }, // Exactly at start
        { at: new Date('2024-01-31T23:59:59Z'), byId: 'user2' }, // Exactly at end
      ],
      period: {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-01-31T23:59:59Z'),
      },
    });

    expect(result.changesInPeriod).toBe(2);
  });

  it('handles empty inputs', () => {
    const result = accommodationsApplied({
      current: [],
      changes: [],
      period: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
    });

    expect(result.count).toBe(0);
    expect(result.byAuthorizer).toEqual({});
    expect(result.changesInPeriod).toBe(0);
  });
});
