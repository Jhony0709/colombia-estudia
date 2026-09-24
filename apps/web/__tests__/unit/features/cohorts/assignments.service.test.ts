/** @jest-environment node */
/**
 * El cambio de versión de una asignación (ola 2 UX, 23/9).
 * SSOT: endpoints.md (`PATCH /api/cohorts/assignments/[id]`),
 * contenido-y-evaluaciones.md («la asignación es (cohorte, tema), no (cohorte, versión)»).
 */

const db = {
  lessonAssignment: { findFirst: jest.fn(), update: jest.fn() },
  assessmentAssignment: { findFirst: jest.fn(), update: jest.fn() },
  lessonProgress: { findMany: jest.fn(), updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};

const notifyMany = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...db,
    $transaction: (fn: (t: typeof db) => unknown) => fn(db),
  })),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => notifyMany(...args),
}));

import { updateAssignmentToLatest } from '@/features/cohorts/server/assignments.service';

const BASE = { institutionId: 'inst-1', actorId: 'actor-1', assignmentId: 'la-1' };
const NOW = new Date('2026-09-23T12:00:00.000Z');

function lessonAssignment(latest: { number: number; invalidatesProgress: boolean } | null) {
  return {
    id: 'la-1',
    cohortId: 'cohort-1',
    lessonVersion: { number: 1 },
    lesson: {
      title: 'Rimas y ritmo',
      versions: latest ? [{ id: `lv-${latest.number}`, ...latest }] : [],
    },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('updateAssignmentToLatest — tema', () => {
  it('pasa a la versión publicada más alta y conserva lo completado si no invalida', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(
      lessonAssignment({ number: 2, invalidatesProgress: false })
    );

    const result = await updateAssignmentToLatest({ ...BASE, kind: 'lesson', now: NOW });

    expect(result).toEqual({ from: 1, to: 2, reopened: 0 });
    expect(db.lessonAssignment.update).toHaveBeenCalledWith({
      where: { id: 'la-1' },
      data: { lessonVersionId: 'lv-2' },
    });
    expect(db.lessonProgress.findMany).not.toHaveBeenCalled();
    expect(db.lessonProgress.updateMany).not.toHaveBeenCalled();
    expect(notifyMany).not.toHaveBeenCalled();
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entity: 'lesson_assignment',
      entityId: 'la-1',
      action: 'version_changed',
      before: { number: 1 },
      after: { number: 2, invalidatesProgress: false, reopened: 0 },
    });
  });

  it('si la versión invalida, reabre los completados con la evidencia intacta y avisa', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(
      lessonAssignment({ number: 2, invalidatesProgress: true })
    );
    db.lessonProgress.findMany.mockResolvedValue([
      { id: 'lp-1', studentId: 'stu-1' },
      { id: 'lp-2', studentId: 'stu-2' },
      // La misma persona con dos filas no recibe dos avisos.
      { id: 'lp-3', studentId: 'stu-1' },
    ]);

    const result = await updateAssignmentToLatest({ ...BASE, kind: 'lesson', now: NOW });

    expect(result).toEqual({ from: 1, to: 2, reopened: 3 });
    expect(db.lessonProgress.findMany).toHaveBeenCalledWith({
      where: { lessonAssignmentId: 'la-1', status: 'COMPLETED' },
      select: { id: true, studentId: true },
    });
    // Solo el estado: nada de borrar `LessonEvidence`.
    expect(db.lessonProgress.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['lp-1', 'lp-2', 'lp-3'] } },
      data: { status: 'IN_PROGRESS', completedAt: null, lessonVersionId: 'lv-2' },
    });
    expect(notifyMany).toHaveBeenCalledTimes(1);
    const [institutionId, recipients, notification] = notifyMany.mock.calls[0];
    expect(institutionId).toBe('inst-1');
    expect(recipients).toEqual(['stu-1', 'stu-2']);
    expect(notification).toMatchObject({
      type: 'lesson_reopened',
      href: '/aprender/tema/la-1',
      dedupeKey: 'lesson_reopened:la-1:2:2026-09-23',
    });
    expect(notification.body).toContain('Rimas y ritmo');
  });

  it('con invalidación pero sin nadie completado no toca el avance ni avisa', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(
      lessonAssignment({ number: 2, invalidatesProgress: true })
    );
    db.lessonProgress.findMany.mockResolvedValue([]);

    const result = await updateAssignmentToLatest({ ...BASE, kind: 'lesson', now: NOW });

    expect(result.reopened).toBe(0);
    expect(db.lessonProgress.updateMany).not.toHaveBeenCalled();
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it('CONFLICT si la cohorte ya tiene la versión más reciente', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(
      lessonAssignment({ number: 1, invalidatesProgress: false })
    );

    await expect(updateAssignmentToLatest({ ...BASE, kind: 'lesson' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(db.lessonAssignment.update).not.toHaveBeenCalled();
  });

  it('CONFLICT si no hay ninguna versión publicada por encima', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(lessonAssignment(null));

    await expect(updateAssignmentToLatest({ ...BASE, kind: 'lesson' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('NOT_FOUND si la asignación no es de esta institución', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(null);

    await expect(updateAssignmentToLatest({ ...BASE, kind: 'lesson' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('updateAssignmentToLatest — examen', () => {
  it('cambia la versión y no reabre nada: los intentos hechos se conservan', async () => {
    db.assessmentAssignment.findFirst.mockResolvedValue({
      id: 'aa-1',
      cohortId: 'cohort-1',
      assessmentVersion: { number: 1 },
      assessment: { title: 'Examen', versions: [{ id: 'av-3', number: 3 }] },
    });

    const result = await updateAssignmentToLatest({
      ...BASE,
      kind: 'assessment',
      assignmentId: 'aa-1',
    });

    expect(result).toEqual({ from: 1, to: 3, reopened: 0 });
    expect(db.assessmentAssignment.update).toHaveBeenCalledWith({
      where: { id: 'aa-1' },
      data: { assessmentVersionId: 'av-3' },
    });
    expect(db.lessonProgress.updateMany).not.toHaveBeenCalled();
    expect(notifyMany).not.toHaveBeenCalled();
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      entity: 'assessment_assignment',
      action: 'version_changed',
      before: { number: 1 },
      after: { number: 3, cohortId: 'cohort-1' },
    });
  });
});
