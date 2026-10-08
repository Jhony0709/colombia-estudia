/** @jest-environment node */
/**
 * El catálogo del estudiante (25/9): qué cursos ve y cómo se inscribe solo.
 * SSOT: features/learn/server/catalog.service.ts.
 */

const db = {
  cohort: { findMany: jest.fn(), findFirst: jest.fn() },
  person: { findFirst: jest.fn() },
  module: { findFirst: jest.fn() },
};
const mockCurrentPriceFor = jest.fn();
const mockOpenEnrollRequest = jest.fn(async () => ({
  id: 'r-1',
  createdAt: '2026-10-06T15:00:00.000Z',
  already: false,
}));
const mockEnrollPerson = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/media/storage', () => ({
  createReadUrl: jest.fn(async (path: string) => `https://storage.test/${path}`),
}));
jest.mock('@/features/cohorts/server/enrollments.service', () => ({
  enrollPerson: (...args: unknown[]) => mockEnrollPerson(...args),
}));
// Tras inscribirse se calcula el primer paso (6/10): la ruta la da la cohorte.
const mockGetCohortOutline = jest.fn(async () => ({
  resume: { kind: 'LESSON', assignmentId: 'a-1' },
}));
jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: (...args: unknown[]) => mockGetCohortOutline(...(args as [])),
}));

jest.mock('@/features/billing/server/prices.service', () => ({
  currentPriceFor: (...args: unknown[]) => mockCurrentPriceFor(...args),
}));
jest.mock('@/features/requests/server/requests.service', () => ({
  openEnrollRequest: (...args: unknown[]) => mockOpenEnrollRequest(...(args as [])),
}));

import {
  getCoursePreview,
  listOpenCourses,
  requestEnrollment,
  selfEnroll,
} from '@/features/learn/server/catalog.service';

const BASE = { institutionId: 'inst-1', personId: 'p-1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listOpenCourses', () => {
  it('asks for open cohorts the person did not leave, free and paid, one course per component', async () => {
    db.cohort.findMany.mockResolvedValue([
      {
        id: 'c-1',
        enrollments: [],
        code: 'INTRO-1',
        name: 'Introducción septiembre',
        startsOn: new Date('2026-09-01T00:00:00.000Z'),
        endsOn: new Date('2026-12-15T00:00:00.000Z'),
        program: {
          id: 'prog-1',
          name: 'Introducción',
          pricing: 'FREE',
          modules: [
            {
              id: 'm-1',
              code: 'COM-0001',
              name: 'Aprender es avanzar',
              description: 'Gestión de emociones',
              grade: null,
              coverMedia: { providerRef: 'inst-1/image/m-1.png', status: 'READY' },
              lessons: [
                { requiresSubmission: false, subject: { name: 'Gestión de emociones' } },
                { requiresSubmission: false, subject: { name: 'Gestión de emociones' } },
                { requiresSubmission: true, subject: { name: 'Gestión de emociones' } },
              ],
              assessments: [{ subject: { name: 'Gestión de emociones' } }],
            },
          ],
        },
      },
    ]);

    const courses = await listOpenCourses(BASE);

    expect(db.cohort.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'OPEN',
          program: { archivedAt: null },
          enrollments: { none: { studentId: 'p-1', status: 'WITHDRAWN' } },
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
        lessonCount: 2,
        activityCount: 1,
        assessmentCount: 1,
        hasAssessment: true,
        workshops: [
          { name: 'Gestión de emociones', lessonCount: 2, activityCount: 1, hasQuiz: true },
        ],
        programId: 'prog-1',
        programName: 'Introducción',
        position: 1,
        programModules: 1,
        cohortCode: 'INTRO-1',
        cohortName: 'Introducción septiembre',
        startsOn: '2026-09-01',
        endsOn: '2026-12-15',
        free: true,
        enrollment: null,
        beforeEntry: false,
        price: null,
      },
    ]);
    expect(mockCurrentPriceFor).not.toHaveBeenCalled();
  });

  it('a paid program lists each component with its place in the program and its price, after the free ones', async () => {
    const cohort = (id: string, pricing: 'FREE' | 'PAID', grade: number | null) => ({
      id,
      enrollments: pricing === 'FREE' ? [{ id: 'e-intro', status: 'ACTIVE' }] : [],
      code: id.toUpperCase(),
      name: id,
      startsOn: new Date('2026-09-01T00:00:00.000Z'),
      endsOn: new Date('2026-12-15T00:00:00.000Z'),
      program: {
        id: `prog-${id}`,
        name: id,
        pricing,
        modules: [1, 2].slice(0, pricing === 'PAID' ? 2 : 1).map((n) => ({
          id: `m-${id}-${n}`,
          code: 'COM-0002',
          name: `curso ${id} ${n}`,
          description: null,
          grade,
          coverMedia: null,
          lessons: [{ requiresSubmission: false, subject: { name: 'Lengua castellana' } }],
          assessments: [],
        })),
      },
    });
    db.cohort.findMany.mockResolvedValue([
      cohort('bach', 'PAID', 9),
      cohort('intro', 'FREE', null),
    ]);
    mockCurrentPriceFor.mockResolvedValue({ amount: 90000, period: 'MONTHLY' });

    const courses = await listOpenCourses(BASE);

    // Un componente por tarjeta (7/10), con su lugar en el programa.
    expect(
      courses.map((c) => [c.moduleId, c.free, c.price, `${c.position}/${c.programModules}`])
    ).toEqual([
      // En la que ya está se lista igual, marcada (7/10).
      ['m-intro-1', true, null, '1/1'],
      ['m-bach-1', false, { amount: 90000, period: 'MONTHLY' }, '1/2'],
      ['m-bach-2', false, { amount: 90000, period: 'MONTHLY' }, '2/2'],
    ]);
    expect(courses[0]?.enrollment).toEqual({ id: 'e-intro', status: 'ACTIVE' });
    expect(courses[1]?.enrollment).toBeNull();
    expect(mockCurrentPriceFor).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      programId: 'prog-bach',
      grade: 9,
    });
  });
});

describe('listOpenCourses, entry point', () => {
  it('components before the enrollment entry are listed without being marked as theirs', async () => {
    db.cohort.findMany.mockResolvedValue([
      {
        id: 'c-bach',
        enrollments: [{ id: 'e-1', status: 'ACTIVE', startsAtModule: 2 }],
        code: 'BACH',
        name: 'Bachillerato',
        startsOn: new Date('2026-10-01T00:00:00.000Z'),
        endsOn: new Date('2027-06-30T00:00:00.000Z'),
        program: {
          id: 'prog-bach',
          name: 'Bachillerato',
          pricing: 'PAID',
          modules: [1, 2, 3].map((n) => ({
            id: `m-${n}`,
            code: `COM-${n}`,
            name: `Componente ${n}`,
            description: null,
            grade: null,
            position: n,
            coverMedia: null,
            lessons: [],
            assessments: [],
          })),
        },
      },
    ]);
    mockCurrentPriceFor.mockResolvedValue(null);

    const courses = await listOpenCourses(BASE);

    expect(courses.map((c) => [c.moduleId, c.beforeEntry, c.enrollment?.id ?? null])).toEqual([
      ['m-1', true, null],
      ['m-2', false, 'e-1'],
      ['m-3', false, 'e-1'],
    ]);
  });
});

describe('requestEnrollment', () => {
  it('only for open cohorts of paid programs: otherwise 404 and no request', async () => {
    db.cohort.findFirst.mockResolvedValue(null);
    await expect(
      requestEnrollment({ ...BASE, cohortId: 'c-free', moduleId: 'm-1' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.cohort.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-free', status: 'OPEN', program: { pricing: 'PAID', archivedAt: null } },
      })
    );
    expect(mockOpenEnrollRequest).not.toHaveBeenCalled();
  });

  it('opens a request for operations, named after the program, and says when', async () => {
    db.cohort.findFirst.mockResolvedValue({
      code: 'BACH-2026-2',
      program: { name: 'Bachillerato por ciclos', modules: [{ name: 'Fundamentos' }] },
    });
    db.person.findFirst.mockResolvedValue({ givenName: 'Ana', familyName: 'Ruiz' });
    const now = new Date('2026-10-06T15:00:00.000Z');

    const result = await requestEnrollment({ ...BASE, cohortId: 'c-bach', moduleId: 'm-9', now });

    expect(mockOpenEnrollRequest).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      personId: 'p-1',
      cohortId: 'c-bach',
      moduleId: 'm-9',
      courseName: 'Bachillerato por ciclos · Fundamentos',
      cohortCode: 'BACH-2026-2',
      personName: 'Ana Ruiz',
      now,
    });
    expect(result).toEqual({ requestedAt: '2026-10-06T15:00:00.000Z' });
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
    // Inscribirse es para empezar: devuelve el primer tema que se puede abrir.
    expect(result).toEqual({ enrollmentId: 'e-1', startHref: '/aprender/tema/a-1' });
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

describe('getCoursePreview', () => {
  const cohort = (enrollments: Array<{ id: string; status: string }> = []) => ({
    id: 'c-1',
    enrollments,
    code: 'BACH-1',
    name: 'Bachillerato 2026',
    startsOn: new Date('2026-10-01T00:00:00.000Z'),
    endsOn: new Date('2027-06-30T00:00:00.000Z'),
    program: {
      id: 'prog-2',
      name: 'Bachillerato',
      pricing: 'FREE',
      modules: [
        {
          id: 'm-1',
          code: 'COM-1',
          name: 'Fundamentos',
          description: null,
          grade: null,
          coverMedia: null,
          lessons: [],
          assessments: [],
        },
        {
          id: 'm-2',
          code: 'COM-2',
          name: 'Consolidación',
          description: null,
          grade: null,
          coverMedia: null,
          lessons: [],
          assessments: [],
        },
      ],
    },
  });

  it('is null for what the catalog does not list', async () => {
    db.cohort.findMany.mockResolvedValue([cohort()]);
    const out = await getCoursePreview({ ...BASE, cohortId: 'c-1', moduleId: 'm-9' });
    expect(out).toBeNull();
    expect(db.module.findFirst).not.toHaveBeenCalled();
  });

  it('groups the content by workshop like the route, quizzes last, and lists the siblings', async () => {
    db.cohort.findMany.mockResolvedValue([cohort()]);
    db.module.findFirst.mockResolvedValue({
      lessons: [
        { id: 'l-1', title: 'Leer', requiresSubmission: false, subject: { name: 'Lengua' } },
        { id: 'l-2', title: 'Sumar', requiresSubmission: false, subject: { name: 'Matemáticas' } },
        { id: 'l-3', title: 'Escribir', requiresSubmission: true, subject: { name: 'Lengua' } },
      ],
      assessments: [
        { id: 'q-1', title: 'Cuestionario de lengua', subject: { name: 'Lengua' } },
        { id: 'q-2', title: 'Examen final', subject: null },
      ],
    });

    const out = await getCoursePreview({ ...BASE, cohortId: 'c-1', moduleId: 'm-1' });

    expect(out?.course.name).toBe('Fundamentos');
    expect(out?.workshops).toEqual([
      {
        name: 'Lengua',
        items: [
          { id: 'l-1', title: 'Leer', form: 'MARKDOWN' },
          { id: 'l-3', title: 'Escribir', form: 'SUBMISSION' },
          { id: 'q-1', title: 'Cuestionario de lengua', form: 'ASSESSMENT' },
        ],
      },
      { name: 'Matemáticas', items: [{ id: 'l-2', title: 'Sumar', form: 'MARKDOWN' }] },
    ]);
    expect(out?.moduleItems).toEqual([{ id: 'q-2', title: 'Examen final', form: 'ASSESSMENT' }]);
    expect(out?.siblings).toEqual([{ moduleId: 'm-2', name: 'Consolidación', position: 2 }]);
  });

  it("marks the person's own enrollment so the page can send them to their route", async () => {
    db.cohort.findMany.mockResolvedValue([cohort([{ id: 'e-1', status: 'ACTIVE' }])]);
    db.module.findFirst.mockResolvedValue({ lessons: [], assessments: [] });
    const out = await getCoursePreview({ ...BASE, cohortId: 'c-1', moduleId: 'm-2' });
    expect(out?.course.enrollment).toEqual({ id: 'e-1', status: 'ACTIVE' });
  });
});
