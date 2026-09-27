/** @jest-environment node */
/**
 * El catálogo del estudiante (25/9): qué cursos ve y cómo se inscribe solo.
 * SSOT: features/learn/server/catalog.service.ts.
 */

const db = {
  cohort: { findMany: jest.fn(), findFirst: jest.fn() },
  person: { findFirst: jest.fn() },
};
const mockEnrollPerson = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/media/storage', () => ({
  createReadUrl: jest.fn(async (path: string) => `https://storage.test/${path}`),
}));
jest.mock('@/features/cohorts/server/enrollments.service', () => ({
  enrollPerson: (...args: unknown[]) => mockEnrollPerson(...args),
}));

import { listOpenFreeCourses, selfEnroll } from '@/features/learn/server/catalog.service';

const BASE = { institutionId: 'inst-1', personId: 'p-1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listOpenFreeCourses', () => {
  it('asks only for open cohorts of free programs the person is not in, one course per component', async () => {
    db.cohort.findMany.mockResolvedValue([
      {
        id: 'c-1',
        code: 'INTRO-1',
        name: 'Introducción septiembre',
        startsOn: new Date('2026-09-01T00:00:00.000Z'),
        endsOn: new Date('2026-12-15T00:00:00.000Z'),
        program: {
          name: 'Introducción',
          modules: [
            {
              id: 'm-1',
              code: 'COM-0001',
              name: 'Aprender es avanzar',
              description: 'Gestión de emociones',
              grade: null,
              coverMedia: { providerRef: 'inst-1/image/m-1.png', status: 'READY' },
              _count: { lessons: 7, assessments: 1 },
            },
          ],
        },
      },
    ]);

    const courses = await listOpenFreeCourses(BASE);

    expect(db.cohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'OPEN',
          program: { pricing: 'FREE', archivedAt: null },
          enrollments: { none: { studentId: 'p-1' } },
        },
      })
    );
    expect(courses).toEqual([
      {
        cohortId: 'c-1',
        moduleId: 'm-1',
        code: 'COM-0001',
        name: 'Aprender es avanzar',
        description: 'Gestión de emociones',
        grade: null,
        coverUrl: 'https://storage.test/inst-1/image/m-1.png',
        lessonCount: 7,
        hasAssessment: true,
        programName: 'Introducción',
        cohortCode: 'INTRO-1',
        cohortName: 'Introducción septiembre',
        startsOn: '2026-09-01',
        endsOn: '2026-12-15',
      },
    ]);
  });
});

const MODULES: { id: string; position: number; grade: number | null }[] = [
  { id: 'm-1', position: 1, grade: null },
  { id: 'm-2', position: 2, grade: null },
];
const openCohort = (modules = MODULES) => ({ program: { modules } });

describe('selfEnroll', () => {
  it('refuses a cohort that is not an open free one, as NOT_FOUND', async () => {
    db.cohort.findFirst.mockResolvedValue(null);

    await expect(
      selfEnroll({ ...BASE, cohortId: 'c-paid', moduleId: 'm-1' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockEnrollPerson).not.toHaveBeenCalled();
  });

  it('refuses a component that is not in that program, as NOT_FOUND', async () => {
    db.cohort.findFirst.mockResolvedValue(openCohort());

    await expect(
      selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-other' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockEnrollPerson).not.toHaveBeenCalled();
  });

  it('enrols through enrollPerson with the person as actor, by email, from the start', async () => {
    db.cohort.findFirst.mockResolvedValue(openCohort());
    db.person.findFirst.mockResolvedValue({ email: 'ana@example.com', documentNumber: '123' });
    mockEnrollPerson.mockResolvedValue({ enrollmentId: 'e-1', warning: null });

    const result = await selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-1' });

    expect(mockEnrollPerson).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      actorId: 'p-1',
      cohortId: 'c-1',
      personHandle: 'ana@example.com',
      now: expect.any(Date),
    });
    expect(result).toEqual({ enrollmentId: 'e-1' });
  });

  it('enters by position when the chosen course is not the first and the program has no grades', async () => {
    db.cohort.findFirst.mockResolvedValue(openCohort());
    db.person.findFirst.mockResolvedValue({ email: 'ana@example.com', documentNumber: null });
    mockEnrollPerson.mockResolvedValue({ enrollmentId: 'e-1', warning: null });

    await selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-2' });

    expect(mockEnrollPerson).toHaveBeenCalledWith(expect.objectContaining({ startsAtModule: 2 }));
  });

  it('enters by grade when the program has grades', async () => {
    db.cohort.findFirst.mockResolvedValue(
      openCohort([
        { id: 'm-1', position: 1, grade: 6 },
        { id: 'm-2', position: 2, grade: 7 },
      ])
    );
    db.person.findFirst.mockResolvedValue({ email: 'ana@example.com', documentNumber: null });
    mockEnrollPerson.mockResolvedValue({ enrollmentId: 'e-1', warning: null });

    await selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-2' });

    expect(mockEnrollPerson).toHaveBeenCalledWith(
      expect.not.objectContaining({ startsAtModule: expect.anything() })
    );
    expect(mockEnrollPerson).toHaveBeenCalledWith(expect.objectContaining({ entryGrade: 7 }));
  });

  it('falls back to the document number when the person has no email', async () => {
    db.cohort.findFirst.mockResolvedValue(openCohort());
    db.person.findFirst.mockResolvedValue({ email: null, documentNumber: '123' });
    mockEnrollPerson.mockResolvedValue({ enrollmentId: 'e-1', warning: null });

    await selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-1' });

    expect(mockEnrollPerson).toHaveBeenCalledWith(expect.objectContaining({ personHandle: '123' }));
  });

  it('says so when the account has neither email nor document', async () => {
    db.cohort.findFirst.mockResolvedValue(openCohort());
    db.person.findFirst.mockResolvedValue({ email: null, documentNumber: null });

    await expect(selfEnroll({ ...BASE, cohortId: 'c-1', moduleId: 'm-1' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
