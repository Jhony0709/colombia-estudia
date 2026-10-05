/** @jest-environment node */
/**
 * `submitLesson` (27/9): la entrega normal queda en revisión y avisa al equipo; con
 * `Lesson.activityAutoApprove` nace aprobada, completa el tema y no avisa a nadie.
 */

const mockGetCohortOutline = jest.fn();
const mockNotifyMany = jest.fn();
const mockStaffPersonIds = jest.fn();

const tx = {
  submission: { update: jest.fn(), create: jest.fn() },
  lessonProgress: { upsert: jest.fn() },
  learningEvent: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  ...tx,
  lessonAssignment: { findFirst: jest.fn() },
  mediaAsset: { findFirst: jest.fn() },
  submission: { ...tx.submission, findFirst: jest.fn() },
  $transaction: (fn: (t: typeof tx) => unknown) => fn({ ...tx, submission: db.submission }),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/media/storage', () => ({ createReadUrl: jest.fn(async () => 'https://x') }));
jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: (...args: unknown[]) => mockGetCohortOutline(...args),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  staffPersonIds: (...args: unknown[]) => mockStaffPersonIds(...args),
}));
const mockIssueAfterProgress = jest.fn();
jest.mock('@/features/certificates/server/certificates.service', () => ({
  issueAfterProgress: (...args: unknown[]) => mockIssueAfterProgress(...args),
}));

import { submitLesson } from '@/features/learn/server/submission.service';

const NOW = new Date('2026-09-27T12:00:00.000Z');
const BASE = {
  institutionId: 'inst-1',
  personId: 'p-1',
  assignmentId: 'asg-1',
  text: 'Mi reflexión',
  answers: null,
  fileAssetId: null,
  now: NOW,
};

const outline = {
  gate: null,
  enrollmentId: 'e-1',
  cohort: { id: 'c-1', code: 'INTRO-1' },
  modules: [{ id: 'm-1', items: [{ assignmentId: 'asg-1', kind: 'LESSON', enabled: true }] }],
};

const assignment = (autoApprove: boolean) => ({
  lessonVersionId: 'lv-1',
  lesson: {
    id: 'l-1',
    title: 'Actividad práctica 1',
    requiresSubmission: true,
    activityAccepts: 'TEXT',
    activityPrompts: null,
    activityAutoApprove: autoApprove,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCohortOutline.mockResolvedValue(outline);
  // Primera lectura: ¿hay entrega previa? (no). Segunda: la vista que se devuelve al final.
  db.submission.findFirst.mockResolvedValueOnce(null).mockResolvedValue({
    id: 'sub-1',
    status: 'SUBMITTED',
    text: 'Mi reflexión',
    answers: null,
    feedback: null,
    submittedAt: NOW,
    reviewedAt: null,
    file: null,
  });
  db.submission.create.mockResolvedValue({ id: 'sub-1' });
  mockStaffPersonIds.mockResolvedValue(['staff-1']);
});

describe('submitLesson', () => {
  it('queda en revisión y avisa al equipo cuando la actividad no se aprueba sola', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(assignment(false));

    await submitLesson(BASE);

    expect(db.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) })
    );
    expect(tx.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'IN_PROGRESS' }) })
    );
    expect(mockNotifyMany).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(mockIssueAfterProgress).not.toHaveBeenCalled();
  });

  it('nace aprobada, completa el tema y no avisa a nadie con aprobación automática (27/9)', async () => {
    db.lessonAssignment.findFirst.mockResolvedValue(assignment(true));

    await submitLesson(BASE);

    expect(db.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', reviewedById: null, reviewedAt: NOW }),
      })
    );
    // Primero «en curso» (la entrega es evidencia de empezar), luego «completado».
    const upserts = tx.lessonProgress.upsert.mock.calls.map(
      (c) => c[0].update.status ?? c[0].create.status
    );
    expect(upserts).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(tx.learningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'lesson.completed' }) })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'auto_approved' }) })
    );
    expect(mockNotifyMany).not.toHaveBeenCalled();
    // Si era el último paso, la matrícula se cierra en el acto (5/10).
    expect(mockIssueAfterProgress).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      enrollmentId: 'e-1',
      now: NOW,
    });
  });
});
