/**
 * Tests for attempt-policy.ts
 * SSOT: reference/04-business-logic/ajustes-razonables.md
 */

import { getAttemptDeadline, getAttemptsAllowed } from './attempt-policy';
import type { Accommodation, AssessmentAssignment, AssessmentVersion, Enrollment } from './types';

// ─────────────────────────── Test Helpers ───────────────────────────

const BASE_DATE = new Date('2024-06-15T12:00:00Z');

function minutesFromBase(minutes: number): Date {
  return new Date(BASE_DATE.getTime() + minutes * 60 * 1000);
}

function createAssessmentVersion(overrides?: Partial<AssessmentVersion>): AssessmentVersion {
  return {
    id: 'version-1',
    timeLimitMinutes: 60,
    maxAttempts: 3,
    ...overrides,
  };
}

function createAssignment(overrides?: Partial<AssessmentAssignment>): AssessmentAssignment {
  return {
    id: 'assignment-1',
    dueAt: null,
    ...overrides,
  };
}

function createEnrollment(overrides?: Partial<Enrollment>): Enrollment {
  return {
    id: 'enrollment-1',
    studentId: 'student-1',
    cohortId: 'cohort-1',
    status: 'ACTIVE',
    isMinorAtEnrollment: false,
    accessUntil: minutesFromBase(1440), // 24 hours from base
    ...overrides,
  };
}

function createAccommodation(overrides?: Partial<Accommodation>): Accommodation {
  return {
    enrollmentId: 'enrollment-1',
    extraTimeFactor: 1,
    exemptFromTimer: false,
    allowedAttemptsBonus: 0,
    ...overrides,
  };
}

// ─────────────────────────── getAttemptDeadline ───────────────────────────

describe('getAttemptDeadline', () => {
  it('sin límite de tiempo y sin dueAt → deadline es fin del día de accessUntil', () => {
    // accessUntil is always present per schema
    // We interpret this as: no time limit and accessUntil (end of day) is the only constraint
    const accessUntil = new Date('2024-06-16T00:00:00.000Z'); // @db.Date
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: null }),
      assignment: createAssignment({ dueAt: null }),
      enrollment: createEnrollment({ accessUntil }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // accessUntil is 2024-06-16, end of day in Bogota = 2024-06-17 04:59:59.999 UTC
    expect(result?.toISOString()).toBe('2024-06-17T04:59:59.999Z');
  });

  it('timeLimitMinutes null = sin límite por tiempo (pero accessUntil aplica)', () => {
    const accessUntil = new Date('2024-06-16T00:00:00.000Z');
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: null }),
      assignment: createAssignment({ dueAt: null }),
      enrollment: createEnrollment({ accessUntil }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // accessUntil end of day in Bogota
    expect(result?.toISOString()).toBe('2024-06-17T04:59:59.999Z');
  });

  it('exemptFromTimer con dueAt → dueAt', () => {
    const dueAt = minutesFromBase(120);
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 60 }),
      assignment: createAssignment({ dueAt }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(1440) }),
      accommodation: createAccommodation({ exemptFromTimer: true }),
      startedAt: BASE_DATE,
    });

    // Exempt from timer, so time limit is ignored. dueAt < accessUntil
    expect(result).toEqual(dueAt);
  });

  it('extraTimeFactor 1.5 sobre 40 min → 60 min', () => {
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 40 }),
      assignment: createAssignment({ dueAt: null }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(1440) }),
      accommodation: createAccommodation({ extraTimeFactor: 1.5 }),
      startedAt: BASE_DATE,
    });

    // 40 * 1.5 = 60 minutes from start
    expect(result).toEqual(minutesFromBase(60));
  });

  it('accessUntil end of day antes que el límite → accessUntil end of day', () => {
    // accessUntil = same day as BASE_DATE but earlier
    // But endOfBogotaDay makes it end of day which is later than time limit
    // So time limit should win in this case
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 60 }),
      assignment: createAssignment({ dueAt: null }),
      enrollment: createEnrollment({ accessUntil: BASE_DATE }), // same day
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // accessUntil is 2024-06-15, end of day in Bogota = 2024-06-16 04:59:59.999 UTC
    // Time limit = 60 min from BASE_DATE = 2024-06-15 13:00:00 UTC
    // Time limit (13:00 UTC) < accessUntil end of day (next day 04:59 UTC)
    // So time limit wins
    expect(result).toEqual(minutesFromBase(60));
  });

  it('dueAt antes que el límite → dueAt', () => {
    const dueAt = minutesFromBase(45);
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 60 }),
      assignment: createAssignment({ dueAt }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(1440) }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // dueAt (45 min) < time limit (60 min) < accessUntil
    expect(result).toEqual(dueAt);
  });

  it('time limit is the minimum when smaller', () => {
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 30 }),
      assignment: createAssignment({ dueAt: minutesFromBase(120) }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(1440) }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // time limit (30 min) < dueAt (120 min) < accessUntil
    expect(result).toEqual(minutesFromBase(30));
  });

  it('accommodation null = factor 1 (default)', () => {
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 60 }),
      assignment: createAssignment({ dueAt: null }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(1440) }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // No accommodation = factor 1, so 60 * 1 = 60 minutes
    expect(result).toEqual(minutesFromBase(60));
  });

  it('all three limits present: returns minimum', () => {
    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: 60 }),
      assignment: createAssignment({ dueAt: minutesFromBase(45) }),
      enrollment: createEnrollment({ accessUntil: minutesFromBase(30) }),
      accommodation: null,
      startedAt: BASE_DATE,
    });

    // dueAt (45 min from base) is before timeLimit (60 min)
    // accessUntil is at end of day in Bogota, which is much later
    // So dueAt wins
    expect(result).toEqual(minutesFromBase(45));
  });

  it('deadline = fin del día Bogota de accessUntil', () => {
    // accessUntil = 2024-06-15T00:00:00Z (@db.Date)
    // End of day in Bogota = 2024-06-15 23:59:59.999 COT = 2024-06-16 04:59:59.999 UTC
    const accessUntil = new Date('2024-06-15T00:00:00.000Z');
    const startedAt = new Date('2024-06-15T12:00:00.000Z');

    const result = getAttemptDeadline({
      assessmentVersion: createAssessmentVersion({ timeLimitMinutes: null }), // no time limit
      assignment: createAssignment({ dueAt: null }), // no dueAt
      enrollment: createEnrollment({ accessUntil }),
      accommodation: null,
      startedAt,
    });

    // Should be end of day 2024-06-15 in Bogota = 2024-06-16 04:59:59.999 UTC
    expect(result?.toISOString()).toBe('2024-06-16T04:59:59.999Z');
  });
});

// ─────────────────────────── getAttemptsAllowed ───────────────────────────

describe('getAttemptsAllowed', () => {
  it('intentos = maxAttempts + allowedAttemptsBonus', () => {
    const result = getAttemptsAllowed({
      assessmentVersion: createAssessmentVersion({ maxAttempts: 3 }),
      accommodation: createAccommodation({ allowedAttemptsBonus: 2 }),
    });

    expect(result).toBe(5);
  });

  it('accommodation null = bonus 0', () => {
    const result = getAttemptsAllowed({
      assessmentVersion: createAssessmentVersion({ maxAttempts: 3 }),
      accommodation: null,
    });

    expect(result).toBe(3);
  });

  it('maxAttempts 1 + bonus 0 = 1', () => {
    const result = getAttemptsAllowed({
      assessmentVersion: createAssessmentVersion({ maxAttempts: 1 }),
      accommodation: createAccommodation({ allowedAttemptsBonus: 0 }),
    });

    expect(result).toBe(1);
  });

  it('large bonus: maxAttempts 2 + bonus 5 = 7', () => {
    const result = getAttemptsAllowed({
      assessmentVersion: createAssessmentVersion({ maxAttempts: 2 }),
      accommodation: createAccommodation({ allowedAttemptsBonus: 5 }),
    });

    expect(result).toBe(7);
  });
});
