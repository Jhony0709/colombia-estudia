/** @jest-environment node */
/**
 * Eventos de uso declarados por el cliente (E0, 23/9): payload cerrado y matrícula propia.
 * SSOT: docs/ux/decision-estudiante-2309.md, endpoints.md (`POST /api/learn/events`).
 */

const db = {
  enrollment: { findFirst: jest.fn() },
  learningEvent: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => db),
}));

import { recordStudentEvent } from '@/features/learn/server/events.service';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const BASE = { institutionId: 'inst-1', personId: 'stu-1', now: NOW };

beforeEach(() => jest.clearAllMocks());

describe('recordStudentEvent', () => {
  it('guarda solo las claves conocidas del payload, nada libre', async () => {
    await recordStudentEvent({
      ...BASE,
      enrollmentId: null,
      type: 'student.primary_action.shown',
      payload: {
        screen: 'aprender',
        action: 'start',
        assignmentId: 'la-1',
        form: 'VIDEO',
        // Lo que un cliente manipulado podría colar: no se guarda.
        ...({ note: 'texto libre', email: 'x@y' } as object),
      },
    });

    expect(db.enrollment.findFirst).not.toHaveBeenCalled();
    expect(db.learningEvent.create).toHaveBeenCalledWith({
      data: {
        institutionId: 'inst-1',
        studentId: 'stu-1',
        enrollmentId: null,
        type: 'student.primary_action.shown',
        payload: { screen: 'aprender', action: 'start', assignmentId: 'la-1', form: 'VIDEO' },
        occurredAt: NOW,
      },
    });
  });

  it('una matrícula que no es de la persona se descarta, no se rechaza', async () => {
    db.enrollment.findFirst.mockResolvedValue(null);

    await recordStudentEvent({
      ...BASE,
      enrollmentId: 'e-de-otro',
      type: 'student.primary_action.clicked',
      payload: { screen: 'lesson', action: 'next' },
    });

    expect(db.enrollment.findFirst).toHaveBeenCalledWith({
      where: { id: 'e-de-otro', studentId: 'stu-1' },
      select: { id: true },
    });
    expect(db.learningEvent.create.mock.calls[0][0].data.enrollmentId).toBeNull();
  });

  it('la matrícula propia sí se guarda', async () => {
    db.enrollment.findFirst.mockResolvedValue({ id: 'e-1' });

    await recordStudentEvent({
      ...BASE,
      enrollmentId: 'e-1',
      type: 'student.primary_action.clicked',
      payload: { screen: 'assessment', action: 'attempt_start', assignmentId: 'aa-1' },
    });

    expect(db.learningEvent.create.mock.calls[0][0].data.enrollmentId).toBe('e-1');
  });
});
