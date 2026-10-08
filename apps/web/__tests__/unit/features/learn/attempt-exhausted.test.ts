/** @jest-environment node */
/**
 * `attemptsExhausted` (3/10): la política `FULL_AFTER_LAST_ATTEMPT` enseña las respuestas
 * correctas solo cuando el estudiante ya no puede volver a presentar: usó todos los intentos
 * o aprobó alguno.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn() }));
jest.mock('@/features/notifications/server/notifications.service', () => ({ notify: jest.fn() }));
jest.mock('@/features/certificates/server/certificates.service', () => ({
  issueAfterProgress: jest.fn(),
}));
jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: jest.fn(),
  listMyEnrollments: jest.fn(),
}));

import { attemptsExhausted } from '@/features/learn/server/attempt.service';

const dec = (n: number) => ({ toNumber: () => n });
const graded = (score: number, max = 10) => ({
  status: 'GRADED',
  score: dec(score),
  maxScore: dec(max),
});
const open = { status: 'IN_PROGRESS', score: null, maxScore: null };

describe('attemptsExhausted', () => {
  it('sin intentos todavía, no está agotado', () => {
    expect(attemptsExhausted({ attempts: [], attemptsAllowed: 2, passPercent: 70 })).toBe(false);
  });

  it('reprobó pero le quedan intentos: no está agotado', () => {
    expect(attemptsExhausted({ attempts: [graded(4)], attemptsAllowed: 2, passPercent: 70 })).toBe(
      false
    );
  });

  it('usó todos los permitidos, aunque reprobara: agotado', () => {
    expect(
      attemptsExhausted({ attempts: [graded(4), graded(5)], attemptsAllowed: 2, passPercent: 70 })
    ).toBe(true);
  });

  it('aprobó alguno: agotado aunque le sobren intentos', () => {
    expect(
      attemptsExhausted({ attempts: [graded(4), graded(8)], attemptsAllowed: 5, passPercent: 70 })
    ).toBe(true);
  });

  // 8/10: con el último en curso, enseñar las respuestas del anterior regalaría el abierto.
  it('con el último intento en curso todavía no está agotado', () => {
    expect(
      attemptsExhausted({ attempts: [graded(4), open], attemptsAllowed: 2, passPercent: 70 })
    ).toBe(false);
  });

  it('el bono de ajuste razonable amplía el cupo', () => {
    expect(
      attemptsExhausted({
        attempts: [graded(4), graded(5)],
        attemptsAllowed: 2 + 1,
        passPercent: 70,
      })
    ).toBe(false);
  });
});
