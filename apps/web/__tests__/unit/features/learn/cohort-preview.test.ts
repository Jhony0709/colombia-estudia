/** @jest-environment node */
/**
 * La ruta en la vista de estudiante (31/10): todo abierto, sin fechas ni secuencia, y un
 * cuestionario cuenta como hecho con haberlo presentado. SSOT: features/learn/server/cohort.service.ts.
 */

const db = {
  enrollment: { findFirst: jest.fn() },
  module: { findMany: jest.fn() },
  enrollmentModule: { findMany: jest.fn() },
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
    db.enrollment.findFirst.mockResolvedValue(enrollment(false));
    const outline = await getCohortOutline({ institutionId: 'inst-1', personId: 'p-1', now: NOW });

    expect(outline.preview).toBe(false);
    expect(outline.modules.map((m) => m.access.state)).toEqual(['OPEN', 'LOCKED']);
    expect(items(outline).find((i) => i.assignmentId === 'a')?.enabled).toBe(false);
    expect(items(outline).find((i) => i.assignmentId === 'q')?.status).toBe('IN_PROGRESS');
  });
});
