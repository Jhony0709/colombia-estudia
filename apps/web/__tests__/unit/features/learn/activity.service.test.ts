/** @jest-environment node */
/**
 * El ritmo del panel (4/10): qué cuenta como paso, qué como día activo, y los días en Bogotá.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));

import {
  isStudentStep,
  summarizeActivity,
  windowDays,
} from '@/features/learn/server/activity.service';

// Domingo 4 de octubre, 10:00 en Bogotá.
const NOW = new Date('2026-10-04T15:00:00.000Z');
const at = (iso: string) => new Date(iso);

describe('isStudentStep', () => {
  it('cuenta lo que termina el estudiante y nada más', () => {
    expect(isStudentStep({ type: 'lesson.completed', payload: { form: 'MARKDOWN' } })).toBe(true);
    expect(isStudentStep({ type: 'lesson.submission.sent', payload: {} })).toBe(true);
    expect(isStudentStep({ type: 'attempt.submitted', payload: {} })).toBe(true);
    expect(isStudentStep({ type: 'lesson.opened', payload: {} })).toBe(false);
  });

  it('no cuenta la aprobación de una actividad ni lo marcado a mano', () => {
    expect(isStudentStep({ type: 'lesson.completed', payload: { form: 'SUBMISSION' } })).toBe(
      false
    );
    expect(isStudentStep({ type: 'lesson.completed', payload: { source: 'MANUAL' } })).toBe(false);
  });
});

describe('windowDays', () => {
  it('va del más antiguo a hoy, en días de Bogotá', () => {
    const days = windowDays(NOW, 14);
    expect(days).toHaveLength(14);
    expect(days[13]).toBe('2026-10-04');
    expect(days[0]).toBe('2026-09-21');
  });
});

describe('summarizeActivity', () => {
  it('agrupa por día de Bogotá: las 23:30 del sábado allí son domingo en UTC', () => {
    const result = summarizeActivity(
      [
        // Sábado 3, 23:30 en Bogotá = domingo 4, 04:30 UTC.
        {
          type: 'lesson.completed',
          payload: { form: 'VIDEO' },
          occurredAt: at('2026-10-04T04:30:00Z'),
        },
        { type: 'lesson.opened', payload: {}, occurredAt: at('2026-10-04T14:00:00Z') },
      ],
      NOW
    );
    const byDate = Object.fromEntries(result.days.map((d) => [d.date, d]));
    expect(byDate['2026-10-03']).toEqual({ date: '2026-10-03', steps: 1, active: true });
    expect(byDate['2026-10-04']).toEqual({ date: '2026-10-04', steps: 0, active: true });
    expect(result.activeDays).toBe(2);
  });

  it('separa esta semana de la anterior e ignora lo que cae fuera de la ventana', () => {
    const result = summarizeActivity(
      [
        { type: 'attempt.submitted', payload: {}, occurredAt: at('2026-10-02T15:00:00Z') },
        { type: 'lesson.submission.sent', payload: {}, occurredAt: at('2026-10-01T15:00:00Z') },
        { type: 'lesson.submission.sent', payload: {}, occurredAt: at('2026-09-25T15:00:00Z') },
        { type: 'lesson.submission.sent', payload: {}, occurredAt: at('2026-09-01T15:00:00Z') },
      ],
      NOW
    );
    expect(result.thisWeek).toBe(2);
    expect(result.lastWeek).toBe(1);
    expect(result.days.reduce((sum, d) => sum + d.steps, 0)).toBe(3);
  });
});
