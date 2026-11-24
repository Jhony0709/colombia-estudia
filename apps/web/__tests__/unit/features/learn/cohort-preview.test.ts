/** @jest-environment node */
/**
 * La ruta en la vista de estudiante (31/10): todo abierto, sin fechas ni secuencia, y un
 * cuestionario cuenta como hecho con haberlo presentado. SSOT: features/learn/server/cohort.service.ts.
 */

const db = {
  enrollment: { findFirst: jest.fn() },
  module: { findMany: jest.fn() },
  enrollmentModule: { findMany: jest.fn() },
  enrollmentLesson: { findMany: jest.fn() },
  accommodation: { findUnique: jest.fn() },
  lessonAssignment: { findMany: jest.fn() },
  assessmentAssignment: { findMany: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/media/storage', () => ({
  COVER_URL_SECONDS: 60,
  createReadUrls: jest.fn(async () => []),
}));

import { getCohortOutline } from '@/features/learn/server/cohort.service';

const NOW = new Date('2026-10-31T15:00:00.000Z');
const FUTURE = new Date('2027-01-01T00:00:00.000Z');

const enrollment = (isPreview: boolean) => ({
  id: 'e-1',
  status: 'ACTIVE',
  accessUntil: isPreview
    ? new Date('2099-12-31T00:00:00.000Z')
    : new Date('2027-06-30T00:00:00.000Z'),
  startsAtModule: null,
  isPreview,
  isMinorAtEnrollment: false,
  cohort: {
    id: 'c-1',
    code: 'BACH-1',
    name: 'Bachillerato',
    status: 'OPEN',
    progression: 'LINEAR',
    startsOn: new Date('2026-10-01T00:00:00.000Z'),
    endsOn: new Date('2027-06-30T00:00:00.000Z'),
    partnerId: null,
    programId: 'prog-1',
    program: { name: 'Bachillerato', pricing: 'PAID' },
  },
  paymentPlan: null,
});

const lesson = (id: string, moduleId: string, availableFrom: Date) => ({
  id,
  availableFrom,
  availableUntil: null,
  lesson: {
    id: `l-${id}`,
    title: `Tema ${id}`,
    moduleId,
    position: 1,
    requiresSubmission: false,
    subject: { id: 's-1', name: 'Matemáticas' },
  },
  lessonVersion: { estimatedMinutes: 5, assets: [] },
  progress: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  db.module.findMany.mockResolvedValue([
    { id: 'm-1', name: 'Uno', position: 1, description: null, coverMedia: null },
    { id: 'm-2', name: 'Dos', position: 2, description: null, coverMedia: null },
  ]);
  db.enrollmentModule.findMany.mockResolvedValue([]);
  db.enrollmentLesson.findMany.mockResolvedValue([]);
  db.accommodation.findUnique.mockResolvedValue(null);
  db.lessonAssignment.findMany.mockResolvedValue([
    lesson('a', 'm-1', FUTURE),
    lesson('b', 'm-2', new Date('2026-10-01T00:00:00.000Z')),
  ]);
  db.assessmentAssignment.findMany.mockResolvedValue([
    {
      id: 'q',
      availableFrom: new Date('2026-10-01T00:00:00.000Z'),
      dueAt: null,
      assessment: {
        id: 'as-1',
        title: 'Cuestionario',
        moduleId: 'm-1',
        lessonId: null,
        position: 1,
        subject: { id: 's-1', name: 'Matemáticas' },
      },
      assessmentVersion: { timeLimitMinutes: 20, maxAttempts: 2, passPercent: 60 },
      attempts: [{ status: 'GRADED', score: 2, maxScore: 10 }],
    },
  ]);
});

const items = (outline: Awaited<ReturnType<typeof getCohortOutline>>) =>
  outline.modules.flatMap((m) => m.items);

describe('getCohortOutline en la vista de estudiante', () => {
  it('abre todo: componentes, fechas y secuencia', async () => {
    db.enrollment.findFirst.mockResolvedValue(enrollment(true));
    const outline = await getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW });

    expect(outline.gate).toBeNull();
    expect(outline.preview).toBe(true);
    expect(outline.modules.map((m) => m.access.state)).toEqual(['OPEN', 'OPEN']);
    expect(items(outline).every((i) => i.enabled)).toBe(true);
    // Reprobado y con intentos por delante: en la vista basta con haberlo presentado.
    expect(items(outline).find((i) => i.assignmentId === 'q')?.status).toBe('COMPLETED');
  });

  it('una cohorte planeada no cierra la vista de estudiante', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      ...enrollment(true),
      cohort: { ...enrollment(true).cohort, status: 'PLANNED', startsOn: FUTURE },
    });
    const outline = await getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW });
    expect(outline.gate).toBeNull();
  });

  it('una matrícula real sigue con sus reglas', async () => {
    db.enrollment.findFirst.mockResolvedValue({ ...enrollment(false), isMinorAtEnrollment: true });
    const outline = await getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW });

    expect(outline.preview).toBe(false);
    expect(outline.modules.map((m) => m.access.state)).toEqual(['OPEN', 'LOCKED']);
    expect(items(outline).find((i) => i.assignmentId === 'a')?.enabled).toBe(false);
    expect(items(outline).find((i) => i.assignmentId === 'q')?.status).toBe('IN_PROGRESS');
  });
});

// Escenario 6 de la maqueta (20/11): programa de pago sin plan todavía.
describe('getCohortOutline · awaitingPlan', () => {
  const run = async (overrides: Record<string, unknown>, isPreview = false) => {
    db.enrollment.findFirst.mockResolvedValue({ ...enrollment(isPreview), ...overrides });
    return (await getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW }))
      .awaitingPlan;
  };

  it('adulto en un programa de pago y sin plan', async () => {
    expect(await run({})).toBe(true);
  });

  it('no para un menor, con plan, en la vista de estudiante ni en un programa gratis', async () => {
    expect(await run({ isMinorAtEnrollment: true })).toBe(false);
    expect(await run({ paymentPlan: { payerType: 'PERSON', installments: [] } })).toBe(false);
    expect(await run({}, true)).toBe(false);
    expect(
      await run({
        cohort: { ...enrollment(false).cohort, program: { name: 'Intro', pricing: 'FREE' } },
      })
    ).toBe(false);
  });
});

// 24/11 (cliente): programa de pago y adulto, nada abierto hasta que operación lo habilite.
describe('getCohortOutline · cerrado por defecto', () => {
  const run = async () => getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW });
  const byId = (outline: Awaited<ReturnType<typeof run>>, id: string) =>
    items(outline).find((i) => i.assignmentId === id);

  beforeEach(() => db.enrollment.findFirst.mockResolvedValue(enrollment(false)));

  it('todo bloqueado, también el primero; lo ya presentado sigue abierto', async () => {
    const outline = await run();

    expect(outline.modules.map((m) => m.access.state)).toEqual(['LOCKED', 'LOCKED']);
    expect(byId(outline, 'b')).toMatchObject({ enabled: false, unavailableReason: 'LOCKED' });
    expect(byId(outline, 'q')?.enabled).toBe(true);
  });

  it('un tema habilitado se abre solo, aunque su componente siga bloqueado', async () => {
    // Sin el cuestionario reprobado, que en LINEAR bloquearía lo de después.
    db.assessmentAssignment.findMany.mockResolvedValue([]);
    db.enrollmentLesson.findMany.mockResolvedValue([{ lessonId: 'l-b' }]);
    const outline = await run();

    expect(outline.modules[1]?.access.state).toBe('LOCKED');
    expect(byId(outline, 'b')).toMatchObject({ enabled: true, blockedBy: null });
  });

  it('un tema empezado sigue abierto', async () => {
    db.assessmentAssignment.findMany.mockResolvedValue([]);
    db.lessonAssignment.findMany.mockResolvedValue([
      { ...lesson('b', 'm-2', NOW), progress: [{ status: 'IN_PROGRESS' }] },
    ]);
    expect(byId(await run(), 'b')?.enabled).toBe(true);
  });

  it('a un menor no le aplica', async () => {
    db.enrollment.findFirst.mockResolvedValue({ ...enrollment(false), isMinorAtEnrollment: true });
    await run();
    expect(db.enrollmentLesson.findMany).not.toHaveBeenCalled();
  });
});
