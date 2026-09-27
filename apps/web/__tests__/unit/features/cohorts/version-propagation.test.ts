/** @jest-environment node */
/**
 * La congelación es de la cohorte, no del contenido (27/9): al publicar, las asignaciones no
 * fijadas de cohortes vivas pasan a la versión nueva.
 * SSOT: contenido-y-evaluaciones.md («La asignación sigue a la versión publicada»).
 */

const db = {
  lessonAssignment: { findMany: jest.fn(), updateMany: jest.fn() },
  assessmentAssignment: { findMany: jest.fn(), updateMany: jest.fn() },
  lessonProgress: { findMany: jest.fn(), updateMany: jest.fn() },
  auditLog: { createMany: jest.fn() },
};
const notifyMany = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => notifyMany(...args),
}));

import {
  propagateLessonVersion,
  propagateAssessmentVersion,
  notifyReopened,
} from '@/features/cohorts/server/version-propagation';

const tx = db as unknown as Parameters<typeof propagateLessonVersion>[0];
const V3 = { id: 'lv-3', number: 3, invalidatesProgress: false };

beforeEach(() => {
  jest.clearAllMocks();
  db.lessonProgress.findMany.mockResolvedValue([]);
});

describe('propagateLessonVersion', () => {
  it('solo mira las no fijadas, de cohortes vivas, que no están ya en esa versión', async () => {
    db.lessonAssignment.findMany.mockResolvedValue([]);

    const result = await propagateLessonVersion(tx, {
      institutionId: 'i1',
      lessonId: 'l1',
      version: V3,
    });

    expect(db.lessonAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lessonId: 'l1',
          pinnedVersion: false,
          lessonVersionId: { not: 'lv-3' },
          cohort: { status: { in: ['PLANNED', 'OPEN'] } },
        },
      })
    );
    expect(result).toEqual({ moved: 0, reopened: [] });
    expect(db.lessonAssignment.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany).not.toHaveBeenCalled();
  });

  it('mueve las encontradas, audita cada una y conserva lo completado si no invalida', async () => {
    db.lessonAssignment.findMany.mockResolvedValue([
      { id: 'la-1', lessonVersion: { number: 1 } },
      { id: 'la-2', lessonVersion: { number: 2 } },
    ]);

    const result = await propagateLessonVersion(tx, {
      institutionId: 'i1',
      lessonId: 'l1',
      version: V3,
    });

    expect(db.lessonAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['la-1', 'la-2'] } },
      data: { lessonVersionId: 'lv-3' },
    });
    expect(db.lessonProgress.findMany).not.toHaveBeenCalled();
    expect(db.auditLog.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        entityId: 'la-1',
        action: 'version_changed',
        before: { number: 1 },
        after: { number: 3, onPublish: true },
      }),
      expect.objectContaining({ entityId: 'la-2', before: { number: 2 } }),
    ]);
    expect(result).toEqual({ moved: 2, reopened: [] });
  });

  it('si la versión invalida, reabre los completados con la evidencia intacta, por asignación', async () => {
    db.lessonAssignment.findMany.mockResolvedValue([
      { id: 'la-1', lessonVersion: { number: 2 } },
      { id: 'la-2', lessonVersion: { number: 2 } },
    ]);
    db.lessonProgress.findMany.mockResolvedValue([
      { id: 'p1', studentId: 's1', lessonAssignmentId: 'la-1' },
      { id: 'p2', studentId: 's2', lessonAssignmentId: 'la-1' },
    ]);

    const result = await propagateLessonVersion(tx, {
      institutionId: 'i1',
      lessonId: 'l1',
      version: { ...V3, invalidatesProgress: true },
    });

    expect(db.lessonProgress.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      data: { status: 'IN_PROGRESS', completedAt: null, lessonVersionId: 'lv-3' },
    });
    expect(result.reopened).toEqual([{ assignmentId: 'la-1', studentIds: ['s1', 's2'] }]);
  });
});

describe('propagateAssessmentVersion', () => {
  it('mueve las no fijadas y no toca ningún intento', async () => {
    db.assessmentAssignment.findMany.mockResolvedValue([
      { id: 'aa-1', assessmentVersion: { number: 1 } },
    ]);

    const result = await propagateAssessmentVersion(tx, {
      institutionId: 'i1',
      assessmentId: 'a1',
      version: { id: 'av-2', number: 2 },
    });

    expect(db.assessmentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessmentId: 'a1',
          pinnedVersion: false,
          assessmentVersionId: { not: 'av-2' },
        }),
      })
    );
    expect(db.assessmentAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['aa-1'] } },
      data: { assessmentVersionId: 'av-2' },
    });
    expect(result).toEqual({ moved: 1 });
  });
});

describe('notifyReopened', () => {
  it('un aviso por asignación, sin repetir estudiantes, con dedupeKey por versión y día', async () => {
    const total = await notifyReopened({
      institutionId: 'i1',
      lessonTitle: 'Rimas y ritmo',
      versionNumber: 3,
      reopened: [{ assignmentId: 'la-1', studentIds: ['s1', 's1', 's2'] }],
      now: new Date('2026-09-27T10:00:00Z'),
    });

    expect(total).toBe(2);
    expect(notifyMany).toHaveBeenCalledWith(
      'i1',
      ['s1', 's2'],
      expect.objectContaining({
        type: 'lesson_reopened',
        href: '/aprender/tema/la-1',
        dedupeKey: 'lesson_reopened:la-1:3:2026-09-27',
      })
    );
  });
});
