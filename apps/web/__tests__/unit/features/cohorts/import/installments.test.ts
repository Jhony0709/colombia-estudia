/** @jest-environment node */
/**
 * El calendario de cuotas que deriva el importador.
 * SSOT: plan/06-cohortes-y-personas.md:54 — "planes de pago y cuotas si vienen".
 *
 * La plantilla trae el total y el número de cuotas, no las fechas: el calendario se deriva.
 * Estas pruebas fijan las dos reglas que eso implica y que no están en el plan, para que
 * cambiarlas sea una decisión y no un descuido.
 */

jest.mock('server-only', () => ({}));

import { planInstallments } from '@/features/cohorts/server/import/import.service';

const START = new Date('2026-02-01T00:00:00.000Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('planInstallments', () => {
  it('reparte el total sin perder ni inventar un peso', () => {
    const cuotas = planInstallments({ total: 1_000_000, count: 3, firstDueOn: START });

    expect(cuotas).toHaveLength(3);
    expect(cuotas.reduce((sum, c) => sum + c.amount, 0)).toBe(1_000_000);
  });

  it('el resto va en la PRIMERA cuota, no en la última', () => {
    // 1.000.000 entre 3 son 333.333 con resto 1.
    const cuotas = planInstallments({ total: 1_000_000, count: 3, firstDueOn: START });

    expect(cuotas.map((c) => c.amount)).toEqual([333_334, 333_333, 333_333]);
  });

  it('la primera vence el día que arranca la cohorte y las demás cada mes', () => {
    const cuotas = planInstallments({ total: 600_000, count: 4, firstDueOn: START });

    expect(cuotas.map((c) => iso(c.dueOn))).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
    ]);
  });

  it('una sola cuota es el total entero el día de arranque', () => {
    const cuotas = planInstallments({ total: 750_000, count: 1, firstDueOn: START });

    expect(cuotas).toEqual([{ position: 1, amount: 750_000, dueOn: START }]);
  });

  it('no desborda de mes: el 31 de enero no se vuelve 3 de marzo', () => {
    const cuotas = planInstallments({
      total: 400_000,
      count: 4,
      firstDueOn: new Date('2026-01-31T00:00:00.000Z'),
    });

    expect(cuotas.map((c) => iso(c.dueOn))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('numera las posiciones desde 1, que es lo que exige @@unique([paymentPlanId, position])', () => {
    const cuotas = planInstallments({ total: 120_000, count: 6, firstDueOn: START });

    expect(cuotas.map((c) => c.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
