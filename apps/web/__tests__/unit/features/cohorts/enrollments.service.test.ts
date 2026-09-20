/** @jest-environment node */
/**
 * Tests for the enrolment cycle.
 * SSOT: plan/06-cohortes-y-personas.md:72-77, endpoints.md:65-66, docs/estado.md §13b
 */

const db = {
  person: { findFirst: jest.fn() },
  guardianship: { findFirst: jest.fn() },
  cohort: { findFirst: jest.fn() },
  enrollment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  membership: { findFirst: jest.fn(), create: jest.fn() },
  installment: { updateMany: jest.fn(), findFirst: jest.fn() },
  // La política de cartera (19/9): apagada en estos tests, así que `enrollPerson` no avisa.
  restrictionPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  auditLog: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...db,
    $transaction: (fn: (t: typeof db) => unknown) => fn(db),
  })),
}));

import {
  resolveAccessUntil,
  bogotaToday,
  enrollPerson,
  withdrawEnrollment,
  extendEnrollment,
} from '@/features/cohorts/server/enrollments.service';

const BASE = { institutionId: 'inst-1', actorId: 'actor-1' };
const NOW = new Date('2026-09-17T12:00:00.000Z');
const MINOR_BIRTH = new Date('2012-05-01T00:00:00.000Z');
const ADULT_BIRTH = new Date('1990-05-01T00:00:00.000Z');

beforeEach(() => jest.clearAllMocks());

describe('resolveAccessUntil', () => {
  it('uses the cohort date when the cohort fixes one for everybody', () => {
    const cohortDate = new Date('2026-12-31');
    expect(
      resolveAccessUntil({
        cohortAccessUntil: cohortDate,
        defaultAccessDays: 300,
        enrolledAt: NOW,
      })
    ).toBe(cohortDate);
  });

  it('otherwise counts the programme days from the day of enrolment', () => {
    const until = resolveAccessUntil({
      cohortAccessUntil: null,
      defaultAccessDays: 30,
      enrolledAt: new Date('2026-09-17T12:00:00.000Z'),
    });
    expect(until.toISOString().slice(0, 10)).toBe('2026-10-17');
  });
});

describe('bogotaToday', () => {
  it('is still the previous day at 02:00 UTC, because Bogotá is UTC-5', () => {
    expect(bogotaToday(new Date('2026-09-18T02:00:00.000Z')).toISOString().slice(0, 10)).toBe(
      '2026-09-17'
    );
  });
});

describe('enrollPerson', () => {
  const cohort = {
    id: 'cohort-1',
    status: 'OPEN',
    accessUntil: null,
    program: { defaultAccessDays: 300 },
  };

  it('refuses a person with no birth date', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: null });

    await expect(
      enrollPerson({ ...BASE, cohortId: 'cohort-1', personHandle: '123', now: NOW })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.enrollment.create).not.toHaveBeenCalled();
  });

  it('refuses a minor with no guardian registered', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: MINOR_BIRTH });
    db.guardianship.findFirst.mockResolvedValue(null);

    await expect(
      enrollPerson({ ...BASE, cohortId: 'cohort-1', personHandle: '123', now: NOW })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.enrollment.create).not.toHaveBeenCalled();
  });

  it('enrols a minor who has a guardian, flagging isMinorAtEnrollment', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: MINOR_BIRTH });
    db.guardianship.findFirst.mockResolvedValue({ id: 'g1' });
    db.cohort.findFirst.mockResolvedValue(cohort);
    db.enrollment.create.mockResolvedValue({ id: 'enr-1' });
    db.membership.findFirst.mockResolvedValue({ id: 'm1' });

    const result = await enrollPerson({
      ...BASE,
      cohortId: 'cohort-1',
      personHandle: '123',
      now: NOW,
    });

    expect(result).toEqual({ enrollmentId: 'enr-1', warning: null });
    expect(db.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isMinorAtEnrollment: true, studentId: 'p1' }),
      select: { id: true },
    });
  });

  it('grants the STUDENT role when the person does not have it', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: ADULT_BIRTH });
    db.cohort.findFirst.mockResolvedValue(cohort);
    db.enrollment.create.mockResolvedValue({ id: 'enr-1' });
    db.membership.findFirst.mockResolvedValue(null);

    await enrollPerson({ ...BASE, cohortId: 'cohort-1', personHandle: '123', now: NOW });

    expect(db.membership.create).toHaveBeenCalledWith({
      data: { institutionId: 'inst-1', personId: 'p1', role: 'STUDENT' },
    });
    expect(db.auditLog.create.mock.calls.map((c) => c[0].data.action)).toEqual([
      'granted',
      'created',
    ]);
  });

  it('refuses a cohort that no longer takes enrolments', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: ADULT_BIRTH });
    db.cohort.findFirst.mockResolvedValue({ ...cohort, status: 'CLOSED' });

    await expect(
      enrollPerson({ ...BASE, cohortId: 'cohort-1', personHandle: '123', now: NOW })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('turns the duplicate enrolment into a readable 409', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p1', birthDate: ADULT_BIRTH });
    db.cohort.findFirst.mockResolvedValue(cohort);
    db.enrollment.create.mockRejectedValue({ unique: true });

    await expect(
      enrollPerson({ ...BASE, cohortId: 'cohort-1', personHandle: '123', now: NOW })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('withdrawEnrollment', () => {
  it('voids only the OPEN instalments that have not fallen due', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'ACTIVE',
      paymentPlan: { id: 'plan-1' },
    });
    db.installment.updateMany.mockResolvedValue({ count: 3 });

    const result = await withdrawEnrollment({
      ...BASE,
      enrollmentId: 'enr-1',
      reason: 'se retiró',
      now: NOW,
    });

    expect(result).toEqual({ id: 'enr-1', voidedInstallments: 3 });
    expect(db.installment.updateMany).toHaveBeenCalledWith({
      where: {
        paymentPlanId: 'plan-1',
        // PARTIALLY_PAID queda fuera a propósito: tiene dinero aplicado.
        status: 'OPEN',
        dueOn: { gt: new Date('2026-09-17') },
      },
      data: { status: 'VOID' },
    });
  });

  it('works for an enrolment with no payment plan', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'ACTIVE',
      paymentPlan: null,
    });

    const result = await withdrawEnrollment({
      ...BASE,
      enrollmentId: 'enr-1',
      reason: 'x',
      now: NOW,
    });

    expect(result.voidedInstallments).toBe(0);
    expect(db.installment.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to withdraw twice', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'WITHDRAWN',
      paymentPlan: null,
    });

    await expect(
      withdrawEnrollment({ ...BASE, enrollmentId: 'enr-1', reason: 'x', now: NOW })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('extendEnrollment', () => {
  it('refuses a date that is not later than the current one', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'ACTIVE',
      accessUntil: new Date('2026-12-31'),
    });

    await expect(
      extendEnrollment({ ...BASE, enrollmentId: 'enr-1', accessUntil: new Date('2026-06-01') })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.enrollment.update).not.toHaveBeenCalled();
  });

  it('refuses to extend a withdrawn enrolment', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'WITHDRAWN',
      accessUntil: new Date('2026-01-01'),
    });

    await expect(
      extendEnrollment({ ...BASE, enrollmentId: 'enr-1', accessUntil: new Date('2027-01-01') })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('extends and audits the two dates', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      status: 'ACTIVE',
      accessUntil: new Date('2026-12-31'),
    });

    const result = await extendEnrollment({
      ...BASE,
      enrollmentId: 'enr-1',
      accessUntil: new Date('2027-03-31'),
    });

    expect(result).toEqual({ id: 'enr-1', accessUntil: '2027-03-31' });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'extended',
        before: { accessUntil: '2026-12-31' },
        after: { accessUntil: '2027-03-31' },
      }),
    });
  });
});
