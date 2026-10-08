/** @jest-environment node */
/**
 * La lista de precios de un programa (8/10): días de Bogotá, estados, y qué se puede corregir.
 * SSOT: features/billing/server/prices.service.ts.
 */

const tx = {
  programPrice: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  program: { findFirst: jest.fn() },
  programPrice: { findMany: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));

import {
  archiveProgramPrice,
  createProgramPrice,
  currentPriceFor,
  deleteProgramPrice,
  updateProgramPrice,
  withPriceStates,
  type ProgramPriceView,
} from '@/features/billing/server/prices.service';

const BASE = { institutionId: 'inst-1', actorId: 'p-1', programId: 'prog-1' };
const INPUT = {
  gradeFrom: null,
  gradeTo: null,
  amount: 95000,
  period: 'PER_MODULE' as const,
  validFrom: '2026-10-07',
  validTo: null,
};

const view = (over: Partial<ProgramPriceView>): ProgramPriceView => ({
  id: 'x',
  programId: 'prog-1',
  gradeFrom: null,
  gradeTo: null,
  amount: 95000,
  period: 'PER_MODULE',
  validFrom: '2026-10-07',
  validTo: null,
  archived: false,
  planCount: 0,
  createdAt: '2026-10-07T12:00:00.000Z',
  state: null,
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  programId: 'prog-1',
  gradeFrom: null,
  gradeTo: null,
  amount: { toNumber: () => 95000 },
  period: 'PER_MODULE',
  validFrom: new Date('2026-10-07T00:00:00.000Z'),
  validTo: null,
  _count: { paymentPlans: 0 },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.program.findFirst.mockResolvedValue({ id: 'prog-1', pricing: 'PAID' });
  db.programPrice.findFirst.mockResolvedValue(null);
  tx.programPrice.create.mockResolvedValue({ id: 'new' });
});

describe('withPriceStates', () => {
  // 8 oct, 20:00 en Bogotá = 9 oct 01:00 UTC: sigue siendo el 8.
  const ON = new Date('2026-10-09T01:00:00.000Z');

  it('uses the Bogotá day: a price from the 9th is still scheduled at 8 p.m. of the 8th', () => {
    const [p] = withPriceStates([view({ validFrom: '2026-10-09' })], ON);
    expect(p?.state).toBe('SCHEDULED');
  });

  it('a price until the 8th is still charged all of the 8th', () => {
    const [p] = withPriceStates([view({ validTo: '2026-10-08' })], ON);
    expect(p?.state).toBe('CURRENT');
  });

  it('the newer one for the same grades replaces the older; other grades are untouched', () => {
    const out = withPriceStates(
      [
        view({ id: 'old', validFrom: '2026-01-01' }),
        view({ id: 'new', validFrom: '2026-10-01' }),
        view({ id: 'g6', gradeFrom: 6, gradeTo: 8, validFrom: '2026-01-01' }),
        view({ id: 'next', validFrom: '2027-01-01' }),
        view({ id: 'gone', gradeFrom: 9, gradeTo: 11, validTo: '2026-09-30' }),
      ],
      ON
    );
    expect(Object.fromEntries(out.map((p) => [p.id, p.state]))).toEqual({
      old: 'REPLACED',
      new: 'CURRENT',
      g6: 'CURRENT',
      next: 'SCHEDULED',
      gone: 'EXPIRED',
    });
  });
});

describe('currentPriceFor', () => {
  it('asks for the Bogotá day at midnight UTC and breaks ties by creation', async () => {
    db.programPrice.findMany.mockResolvedValue([]);
    await currentPriceFor({
      institutionId: 'inst-1',
      programId: 'prog-1',
      grade: null,
      on: new Date('2026-10-09T01:00:00.000Z'),
    });
    const args = db.programPrice.findMany.mock.calls[0]![0];
    expect(args.where.validFrom).toEqual({ lte: new Date('2026-10-08T00:00:00.000Z') });
    expect(args.orderBy).toEqual([{ validFrom: 'desc' }, { createdAt: 'desc' }]);
  });
});

describe('createProgramPrice', () => {
  it('refuses a free program', async () => {
    db.program.findFirst.mockResolvedValue({ id: 'prog-1', pricing: 'FREE' });
    await expect(createProgramPrice({ ...BASE, input: INPUT })).rejects.toThrow(/gratuito/);
    expect(tx.programPrice.create).not.toHaveBeenCalled();
  });

  it('refuses a twin: same grades from the same day', async () => {
    db.programPrice.findFirst.mockResolvedValue({ id: 'twin' });
    await expect(createProgramPrice({ ...BASE, input: INPUT })).rejects.toThrow(/desde ese día/);
  });

  it('creates and audits', async () => {
    await expect(createProgramPrice({ ...BASE, input: INPUT })).resolves.toEqual({ id: 'new' });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'program_price', action: 'created' }),
      })
    );
  });
});

describe('updateProgramPrice / deleteProgramPrice', () => {
  it('only touch a price of that program', async () => {
    db.programPrice.findFirst.mockResolvedValueOnce(null);
    await expect(
      deleteProgramPrice({ ...BASE, programId: 'other', priceId: 'pr-1' })
    ).rejects.toThrow('Price not found');
    expect(db.programPrice.findFirst.mock.calls[0]![0].where).toEqual({
      id: 'pr-1',
      programId: 'other',
      archivedAt: null,
    });
  });

  it('refuse a price that a payment plan uses', async () => {
    db.programPrice.findFirst.mockResolvedValueOnce(row({ _count: { paymentPlans: 2 } }));
    await expect(
      updateProgramPrice({ ...BASE, priceId: 'pr-1', input: { ...INPUT, amount: 99000 } })
    ).rejects.toThrow(/2 plan\(es\)/);
    expect(tx.programPrice.update).not.toHaveBeenCalled();
  });

  it('correct an unused price, auditing before and after', async () => {
    db.programPrice.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(null);
    await updateProgramPrice({ ...BASE, priceId: 'pr-1', input: { ...INPUT, amount: 99000 } });
    expect(tx.programPrice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pr-1' } })
    );
    const audit = tx.auditLog.create.mock.calls[0]![0].data;
    expect(audit.action).toBe('updated');
    expect(audit.before.amount).toBe(95000);
    expect(audit.after.amount).toBe(99000);
  });

  it('delete an unused price for good, leaving the audit', async () => {
    db.programPrice.findFirst.mockResolvedValueOnce(row());
    await deleteProgramPrice({ ...BASE, priceId: 'pr-1' });
    expect(tx.programPrice.delete).toHaveBeenCalledWith({ where: { id: 'pr-1' } });
    expect(tx.auditLog.create.mock.calls[0]![0].data.action).toBe('deleted');
  });
});

describe('archiveProgramPrice', () => {
  it('archives only within the program in the URL', async () => {
    db.programPrice.findFirst.mockResolvedValueOnce(null);
    await expect(
      archiveProgramPrice({ ...BASE, programId: 'other', priceId: 'pr-1' })
    ).rejects.toThrow('Price not found');
    expect(db.programPrice.findFirst.mock.calls[0]![0].where.programId).toBe('other');
  });
});
