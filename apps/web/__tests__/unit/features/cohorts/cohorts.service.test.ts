/** @jest-environment node */
/**
 * Tests for opening a cohort.
 * SSOT: plan/06-cohortes-y-personas.md:26-28, docs/estado.md §13
 *
 * "Abrir crea las asignaciones con las versiones publicadas vigentes (transacción); si un
 * tema no tiene versión publicada, se lista y no se abre."
 */

const tx = {
  cohort: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  program: { findFirst: jest.fn() },
  lesson: { findMany: jest.fn() },
  assessment: { findMany: jest.fn() },
  lessonAssignment: { createMany: jest.fn() },
  assessmentAssignment: { createMany: jest.fn() },
  auditLog: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/errors', () => ({ isUniqueViolation: () => false }));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...tx,
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  })),
}));

import {
  pickPublishedVersion,
  planCohortOpening,
  openCohort,
  closeCohort,
  createCohort,
} from '@/features/cohorts/server/cohorts.service';

const BASE = { institutionId: 'inst-1', actorId: 'actor-1' };

beforeEach(() => jest.clearAllMocks());

describe('pickPublishedVersion', () => {
  it('takes the published version with the highest number', () => {
    expect(
      pickPublishedVersion([
        { id: 'v1', status: 'PUBLISHED', number: 1 },
        { id: 'v3', status: 'PUBLISHED', number: 3 },
        { id: 'v2', status: 'PUBLISHED', number: 2 },
      ])
    ).toMatchObject({ id: 'v3' });
  });

  it('ignores drafts and archived versions, even if they are newer', () => {
    expect(
      pickPublishedVersion([
        { id: 'v1', status: 'PUBLISHED', number: 1 },
        { id: 'v2', status: 'DRAFT', number: 2 },
        { id: 'v3', status: 'ARCHIVED', number: 3 },
      ])
    ).toMatchObject({ id: 'v1' });
  });

  it('is null when nothing is published', () => {
    expect(pickPublishedVersion([{ id: 'v1', status: 'DRAFT', number: 1 }])).toBeNull();
    expect(pickPublishedVersion([])).toBeNull();
  });
});

describe('planCohortOpening', () => {
  const published = [{ id: 'v1', status: 'PUBLISHED', number: 1 }];
  const draftOnly = [{ id: 'v1', status: 'DRAFT', number: 1 }];

  it('pairs every lesson and assessment with its published version', () => {
    const plan = planCohortOpening(
      [{ id: 'l1', title: 'Tema 1', versions: published }],
      [{ id: 'a1', title: 'Evaluación 1', versions: published }]
    );

    expect(plan.lessons).toEqual([{ lessonId: 'l1', lessonVersionId: 'v1' }]);
    expect(plan.assessments).toEqual([{ assessmentId: 'a1', assessmentVersionId: 'v1' }]);
    expect(plan.missing).toEqual([]);
  });

  it('lists what is missing instead of silently skipping it', () => {
    const plan = planCohortOpening(
      [
        { id: 'l1', title: 'Tema listo', versions: published },
        { id: 'l2', title: 'Tema sin publicar', versions: draftOnly },
      ],
      [{ id: 'a1', title: 'Evaluación sin publicar', versions: [] }]
    );

    expect(plan.missing).toEqual([
      { kind: 'lesson', title: 'Tema sin publicar' },
      { kind: 'assessment', title: 'Evaluación sin publicar' },
    ]);
    // Lo que sí estaba listo se calcula igual: el plan informa, no adivina.
    expect(plan.lessons).toHaveLength(1);
  });
});

describe('openCohort', () => {
  const cohort = {
    id: 'cohort-1',
    status: 'PLANNED',
    programId: 'prog-1',
    startsOn: new Date('2026-02-01'),
  };

  it('creates the assignments, flips the status and audits the counts', async () => {
    tx.cohort.findFirst.mockResolvedValue(cohort);
    tx.lesson.findMany.mockResolvedValue([
      { id: 'l1', title: 'T1', versions: [{ id: 'v1', status: 'PUBLISHED', number: 1 }] },
    ]);
    tx.assessment.findMany.mockResolvedValue([
      { id: 'a1', title: 'E1', versions: [{ id: 'av1', status: 'PUBLISHED', number: 1 }] },
    ]);

    const result = await openCohort({ ...BASE, cohortId: 'cohort-1' });

    expect(result).toEqual({ id: 'cohort-1', assigned: 2 });
    expect(tx.lessonAssignment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          cohortId: 'cohort-1',
          lessonId: 'l1',
          lessonVersionId: 'v1',
          assignedById: 'actor-1',
          availableFrom: cohort.startsOn,
        }),
      ],
    });
    expect(tx.cohort.update).toHaveBeenCalledWith({
      where: { id: 'cohort-1' },
      data: { status: 'OPEN' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'opened' }),
    });
  });

  it('refuses and returns the missing content without assigning anything', async () => {
    tx.cohort.findFirst.mockResolvedValue(cohort);
    tx.lesson.findMany.mockResolvedValue([{ id: 'l1', title: 'Tema sin publicar', versions: [] }]);
    tx.assessment.findMany.mockResolvedValue([]);

    await expect(openCohort({ ...BASE, cohortId: 'cohort-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { missing: [{ kind: 'lesson', title: 'Tema sin publicar' }] },
    });
    expect(tx.lessonAssignment.createMany).not.toHaveBeenCalled();
    expect(tx.cohort.update).not.toHaveBeenCalled();
  });

  it('refuses a program with no content at all', async () => {
    tx.cohort.findFirst.mockResolvedValue(cohort);
    tx.lesson.findMany.mockResolvedValue([]);
    tx.assessment.findMany.mockResolvedValue([]);

    await expect(openCohort({ ...BASE, cohortId: 'cohort-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(tx.cohort.update).not.toHaveBeenCalled();
  });

  it('refuses to open a cohort that is not PLANNED', async () => {
    tx.cohort.findFirst.mockResolvedValue({ ...cohort, status: 'OPEN' });

    await expect(openCohort({ ...BASE, cohortId: 'cohort-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('refuses without an actor: the assignment records who made it', async () => {
    await expect(
      openCohort({ institutionId: 'inst-1', actorId: null, cohortId: 'cohort-1' })
    ).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(tx.cohort.findFirst).not.toHaveBeenCalled();
  });
});

describe('closeCohort', () => {
  it('refuses to close a cohort that is not open', async () => {
    tx.cohort.findFirst.mockResolvedValue({ id: 'cohort-1', status: 'PLANNED' });

    await expect(closeCohort({ ...BASE, cohortId: 'cohort-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('closes an open cohort and audits it', async () => {
    tx.cohort.findFirst.mockResolvedValue({ id: 'cohort-1', status: 'OPEN' });

    await closeCohort({ ...BASE, cohortId: 'cohort-1' });

    expect(tx.cohort.update).toHaveBeenCalledWith({
      where: { id: 'cohort-1' },
      data: { status: 'CLOSED' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'closed' }),
    });
  });
});

describe('createCohort', () => {
  it('rejects an end date before the start date before touching the database', async () => {
    await expect(
      createCohort({
        ...BASE,
        data: {
          code: '2026-2',
          name: 'Cohorte',
          programId: 'prog-1',
          partnerId: null,
          progression: 'LINEAR',
          startsOn: new Date('2026-06-01'),
          endsOn: new Date('2026-02-01'),
        },
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tx.cohort.create).not.toHaveBeenCalled();
  });
});
