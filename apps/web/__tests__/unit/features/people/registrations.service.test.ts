/** @jest-environment node */
/**
 * El embudo del registro (1/11): el paso más avanzado y el periodo.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));

import {
  furthestStep,
  introFacts,
  parseRegistrationPeriod,
} from '@/features/people/server/registrations.service';
import type { EnrollmentProgress } from '@/features/cohorts/server/progress.service';

const intro = (over: Partial<EnrollmentProgress>): EnrollmentProgress => ({
  enrollmentId: 'e1',
  personId: 'p1',
  cohortCode: 'INTRO-2026',
  programName: 'Introducción',
  status: 'ACTIVE',
  enrolledAt: '2026-10-01T12:00:00.000Z',
  assigned: 4,
  evidenceCompleted: 0,
  manualCompleted: 0,
  percent: 0,
  assessmentsTaken: 0,
  assessmentsPassed: 0,
  lastActivityAt: null,
  atRisk: true,
  currentModule: null,
  ...over,
});

describe('introFacts', () => {
  it('has not started without activity nor completed lessons', () => {
    expect(introFacts(intro({}))).toEqual({ startedIntro: false, finishedIntro: false });
    expect(introFacts(null)).toEqual({ startedIntro: false, finishedIntro: false });
  });

  it('started with any activity; finished with every lesson or a completed enrollment', () => {
    expect(introFacts(intro({ lastActivityAt: '2026-10-02T12:00:00.000Z' }))).toEqual({
      startedIntro: true,
      finishedIntro: false,
    });
    expect(introFacts(intro({ evidenceCompleted: 3, manualCompleted: 1 })).finishedIntro).toBe(
      true
    );
    expect(introFacts(intro({ status: 'COMPLETED' })).finishedIntro).toBe(true);
  });
});

describe('furthestStep', () => {
  const none = { startedIntro: false, finishedIntro: false, requested: false, enrolled: false };

  it('is the most advanced step, whatever the order the person took', () => {
    expect(furthestStep(none)).toBe('registered');
    expect(furthestStep({ ...none, startedIntro: true })).toBe('startedIntro');
    expect(furthestStep({ ...none, startedIntro: true, finishedIntro: true })).toBe(
      'finishedIntro'
    );
    expect(furthestStep({ ...none, requested: true })).toBe('requested');
    expect(furthestStep({ ...none, enrolled: true })).toBe('enrolled');
  });
});

describe('parseRegistrationPeriod', () => {
  it('accepts 7, 30, 90 and 0 (all); defaults to 30', () => {
    expect(parseRegistrationPeriod('7')).toBe(7);
    expect(parseRegistrationPeriod('0')).toBe(0);
    expect(parseRegistrationPeriod(['90', '7'])).toBe(90);
    expect(parseRegistrationPeriod('15')).toBe(30);
    expect(parseRegistrationPeriod(undefined)).toBe(30);
  });
});
