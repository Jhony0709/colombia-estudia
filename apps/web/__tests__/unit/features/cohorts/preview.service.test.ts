/** @jest-environment node */
/** Vista de estudiante (31/10). SSOT: features/cohorts/server/preview.service.ts. */

const tx = {
  enrollment: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  score: { deleteMany: jest.fn() },
  attempt: { deleteMany: jest.fn() },
  lessonProgress: { deleteMany: jest.fn() },
  submission: { deleteMany: jest.fn() },
  moduleFeedback: { deleteMany: jest.fn() },
  enrollmentModule: { deleteMany: jest.fn() },
  accessRequest: { deleteMany: jest.fn() },
};
const db = {
  cohort: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  enrollment: { findFirst: jest.fn(), update: jest.fn() },
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));

import { resetPreview, startPreview } from '@/features/cohorts/server/preview.service';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const BASE = { institutionId: 'inst-1', actorId: 'admin-1', cohortId: 'c-1', now: NOW };

beforeEach(() => {
  jest.clearAllMocks();
  db.cohort.findFirst.mockResolvedValue({ id: 'c-1' });
  db.cohort.count.mockResolvedValue(1);
  db.enrollment.findFirst.mockResolvedValue(null);
  tx.enrollment.create.mockResolvedValue({ id: 'e-prev' });
});

describe('startPreview', () => {
  it('crea una matrícula de prueba que no vence y no da el rol de estudiante', async () => {
    await expect(startPreview(BASE)).resolves.toEqual({ enrollmentId: 'e-prev' });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 'admin-1',
        cohortId: 'c-1',
        status: 'ACTIVE',
        isPreview: true,
        accessUntil: new Date('2099-12-31T00:00:00.000Z'),
      }),
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity: 'enrollment_preview', action: 'created' }),
    });
  });

  it('reutiliza la que ya existe y la deja como la más reciente', async () => {
    db.enrollment.findFirst.mockResolvedValue({ id: 'e-prev', isPreview: true });
    await expect(startPreview(BASE)).resolves.toEqual({ enrollmentId: 'e-prev' });
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(db.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'e-prev' },
      data: { enrolledAt: NOW },
    });
  });

  it('no convierte una matrícula real en una de prueba', async () => {
    db.enrollment.findFirst.mockResolvedValue({ id: 'e-real', isPreview: false });
    await expect(startPreview(BASE)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });

  it('sin contenido en la ruta, o archivada, no hay nada que recorrer', async () => {
    db.cohort.count.mockResolvedValue(0);
    await expect(startPreview(BASE)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.cohort.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'c-1', status: { not: 'ARCHIVED' } }),
    });
  });

  it('una cohorte que no existe es NOT_FOUND', async () => {
    db.cohort.findFirst.mockResolvedValue(null);
    await expect(startPreview(BASE)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('dos clics a la vez: devuelve la que creó el otro', async () => {
    db.enrollment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'e-prev', isPreview: true });
    tx.enrollment.create.mockRejectedValueOnce({ unique: true });
    await expect(startPreview(BASE)).resolves.toEqual({ enrollmentId: 'e-prev' });
  });
});

describe('resetPreview', () => {
  it('borra lo hecho, nota antes que intento, y deja la matrícula', async () => {
    db.enrollment.findFirst.mockResolvedValue({ id: 'e-prev' });
    const order: string[] = [];
    for (const [name, model] of Object.entries(tx)) {
      if ('deleteMany' in model) {
        (model.deleteMany as jest.Mock).mockImplementation(async () => {
          order.push(name);
          return { count: 0 };
        });
      }
    }

    await expect(resetPreview(BASE)).resolves.toEqual({ enrollmentId: 'e-prev' });
    expect(db.enrollment.findFirst).toHaveBeenCalledWith({
      where: { studentId: 'admin-1', cohortId: 'c-1', isPreview: true },
      select: { id: true },
    });
    expect(order.indexOf('score')).toBeLessThan(order.indexOf('attempt'));
    expect(order).toEqual(
      expect.arrayContaining([
        'lessonProgress',
        'submission',
        'moduleFeedback',
        'enrollmentModule',
        'accessRequest',
      ])
    );
    expect(tx.score.deleteMany).toHaveBeenCalledWith({ where: { enrollmentId: 'e-prev' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity: 'enrollment_preview', action: 'reset' }),
    });
  });

  it('sin vista de estudiante propia en la cohorte es NOT_FOUND', async () => {
    await expect(resetPreview(BASE)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.attempt.deleteMany).not.toHaveBeenCalled();
  });
});
