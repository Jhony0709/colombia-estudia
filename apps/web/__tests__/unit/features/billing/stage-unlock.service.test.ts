/** @jest-environment node */
/**
 * Etapas por cuota (20/11): la cuota pagada habilita sus componentes; nunca para un menor,
 * nunca dos veces. SSOT: reference/04-business-logic/acceso-y-cartera.md §3.
 */

const mockNotify = jest.fn();
const mockCloseRequests = jest.fn();

const tx = {
  enrollmentModule: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  installment: { findFirst: jest.fn() },
  module: { findMany: jest.fn() },
  enrollmentModule: { findMany: jest.fn() },
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));
jest.mock('@/features/requests/server/requests.service', () => ({
  closeRequests: (...args: unknown[]) => mockCloseRequests(...args),
}));

import { openPaidStages } from '@/features/billing/server/stage-unlock.service';
import { stageInstallments } from '@/features/billing/server/stage-installments';

const NOW = new Date('2026-11-20T15:00:00.000Z');
const amount = (value: number) => ({ toNumber: () => value });
const paid = (isMinorAtEnrollment = false) => ({
  unlockModuleIds: ['mod-1', 'mod-2'],
  paymentPlan: {
    enrollment: {
      id: 'enr-1',
      studentId: 'stu-1',
      isMinorAtEnrollment,
      cohort: { programId: 'prog-1' },
    },
  },
});
const BASE = { institutionId: 'inst-1', installmentId: 'ins-1', now: NOW };

beforeEach(() => {
  jest.clearAllMocks();
  db.installment.findFirst.mockResolvedValue(paid());
  db.module.findMany.mockResolvedValue([
    { id: 'mod-1', name: 'Fundamentos' },
    { id: 'mod-2', name: 'Consolidación' },
  ]);
  db.enrollmentModule.findMany.mockResolvedValue([]);
  tx.enrollmentModule.create.mockResolvedValue({ id: 'em-1' });
});

describe('stageInstallments', () => {
  const rows = [
    { position: 1, amount: amount(95000), status: 'PAID', unlockModuleIds: ['mod-1'] },
    { position: 2, amount: amount(95000), status: 'VOID', unlockModuleIds: ['mod-2'] },
    { position: 3, amount: amount(80000), status: 'OPEN', unlockModuleIds: ['mod-2', 'mod-3'] },
  ];

  it('dice qué cuota abre cada componente y no cuenta las anuladas', () => {
    const stages = stageInstallments(false, rows);
    expect(stages.get('mod-1')).toEqual({ position: 1, amount: 95000 });
    expect(stages.get('mod-2')).toEqual({ position: 3, amount: 80000 });
  });

  it('para un menor nunca hay etapas por cuota', () => {
    expect(stageInstallments(true, rows).size).toBe(0);
  });

  it('sin plan no hay nada que abrir', () => {
    expect(stageInstallments(false, undefined).size).toBe(0);
  });
});

describe('openPaidStages', () => {
  it('habilita los componentes de la cuota, audita el motivo y avisa una vez', async () => {
    const opened = await openPaidStages(BASE);

    expect(opened).toEqual(['mod-1', 'mod-2']);
    expect(db.installment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ins-1', status: 'PAID' } })
    );
    expect(tx.enrollmentModule.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'unlock',
          after: expect.objectContaining({ reason: 'installment_paid', installmentId: 'ins-1' }),
        }),
      })
    );
    expect(mockCloseRequests).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ personId: 'stu-1', type: 'module_unlocked' })
    );
  });

  it('no repite lo que ya estaba habilitado', async () => {
    db.enrollmentModule.findMany.mockResolvedValue([{ moduleId: 'mod-1' }]);

    expect(await openPaidStages(BASE)).toEqual(['mod-2']);
    expect(tx.enrollmentModule.create).toHaveBeenCalledTimes(1);
  });

  it('con todo habilitado no escribe ni avisa', async () => {
    db.enrollmentModule.findMany.mockResolvedValue([{ moduleId: 'mod-1' }, { moduleId: 'mod-2' }]);

    expect(await openPaidStages(BASE)).toEqual([]);
    expect(tx.enrollmentModule.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('nunca abre por pago la matrícula de un menor', async () => {
    db.installment.findFirst.mockResolvedValue(paid(true));

    expect(await openPaidStages(BASE)).toEqual([]);
    expect(db.module.findMany).not.toHaveBeenCalled();
    expect(tx.enrollmentModule.create).not.toHaveBeenCalled();
  });

  it('una cuota sin pagar o sin etapas no abre nada', async () => {
    db.installment.findFirst.mockResolvedValue(null);

    expect(await openPaidStages(BASE)).toEqual([]);
    expect(tx.enrollmentModule.create).not.toHaveBeenCalled();
  });
});
