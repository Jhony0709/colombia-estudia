/** @jest-environment node */
/**
 * Habilitación de componentes por matrícula (3/10): habilitar crea la fila, audita y avisa;
 * repetir no hace nada; bloquear borra y audita; en FREE no aplica.
 */

const mockNotify = jest.fn();

const tx = {
  enrollmentModule: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  ...tx,
  enrollment: { findFirst: jest.fn() },
  module: { findFirst: jest.fn(), findMany: jest.fn() },
  enrollmentModule: { ...tx.enrollmentModule, findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

import { listModuleAccess, setModuleAccess } from '@/features/cohorts/server/module-access.service';

const NOW = new Date('2026-10-03T15:00:00.000Z');
const ENROLLMENT = {
  id: 'enr-1',
  studentId: 'stu-1',
  startsAtModule: null,
  cohort: { programId: 'prog-1', progression: 'LINEAR' },
};
const BASE = { institutionId: 'inst-1', actorId: 'staff-1', enrollmentId: 'enr-1', now: NOW };

beforeEach(() => {
  jest.clearAllMocks();
  db.enrollment.findFirst.mockResolvedValue(ENROLLMENT);
  db.module.findFirst.mockResolvedValue({ id: 'mod-2', name: 'Fundamentos' });
  db.enrollmentModule.findFirst.mockResolvedValue(null);
  tx.enrollmentModule.create.mockResolvedValue({ id: 'em-1' });
  tx.enrollmentModule.update.mockResolvedValue({ id: 'em-1' });
});

describe('setModuleAccess', () => {
  it('habilitar crea la fila con quién y cuándo, audita `unlock` y avisa al estudiante', async () => {
    const result = await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: true });

    expect(result).toEqual({ changed: true, state: 'OPEN' });
    expect(tx.enrollmentModule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentId: 'enr-1',
          moduleId: 'mod-2',
          unlockedById: 'staff-1',
          unlockedAt: NOW,
          availableFrom: null,
          availableUntil: null,
        }),
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'enrollment_module', action: 'unlock' }),
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        personId: 'stu-1',
        type: 'module_unlocked',
        href: '/aprender',
        dedupeKey: 'module_unlocked:enr-1:mod-2:2026-10-03',
      })
    );
  });

  it('las fechas son días en Bogotá: desde las 00:00 hasta las 23:59', async () => {
    const result = await setModuleAccess({
      ...BASE,
      moduleId: 'mod-2',
      unlocked: true,
      availableFrom: '2026-10-10',
      availableUntil: '2026-12-15',
    });

    expect(result.state).toBe('NOT_YET');
    expect(tx.enrollmentModule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availableFrom: new Date('2026-10-10T05:00:00.000Z'),
          availableUntil: new Date('2026-12-16T04:59:59.999Z'),
        }),
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ body: expect.stringContaining('2026-10-10') })
    );
  });

  it('inicio posterior al cierre: se rechaza antes de tocar la base', async () => {
    await expect(
      setModuleAccess({
        ...BASE,
        moduleId: 'mod-2',
        unlocked: true,
        availableFrom: '2026-12-01',
        availableUntil: '2026-11-01',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(tx.enrollmentModule.create).not.toHaveBeenCalled();
  });

  it('ya habilitado con las mismas fechas: no escribe ni avisa', async () => {
    db.enrollmentModule.findFirst.mockResolvedValue({
      id: 'em-1',
      availableFrom: null,
      availableUntil: null,
    });

    const result = await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: true });

    expect(result).toEqual({ changed: false, state: 'OPEN' });
    expect(tx.enrollmentModule.update).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('cambiar las fechas de uno habilitado actualiza, audita `update` y no vuelve a avisar', async () => {
    db.enrollmentModule.findFirst.mockResolvedValue({
      id: 'em-1',
      availableFrom: null,
      availableUntil: null,
    });

    await setModuleAccess({
      ...BASE,
      moduleId: 'mod-2',
      unlocked: true,
      availableUntil: '2026-12-15',
    });

    expect(tx.enrollmentModule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'em-1' } })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'update' }) })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('bloquear borra la fila y audita `lock`; bloquear lo bloqueado no hace nada', async () => {
    db.enrollmentModule.findFirst.mockResolvedValue({
      id: 'em-1',
      availableFrom: null,
      availableUntil: null,
    });
    expect(await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: false })).toEqual({
      changed: true,
      state: 'LOCKED',
    });
    expect(tx.enrollmentModule.delete).toHaveBeenCalledWith({ where: { id: 'em-1' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'lock' }) })
    );

    jest.clearAllMocks();
    db.enrollment.findFirst.mockResolvedValue(ENROLLMENT);
    db.module.findFirst.mockResolvedValue({ id: 'mod-2', name: 'Fundamentos' });
    db.enrollmentModule.findFirst.mockResolvedValue(null);
    expect(await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: false })).toEqual({
      changed: false,
      state: 'LOCKED',
    });
    expect(tx.enrollmentModule.delete).not.toHaveBeenCalled();
  });

  it('un componente de otro programa no existe para esta matrícula', async () => {
    db.module.findFirst.mockResolvedValue(null);
    await expect(
      setModuleAccess({ ...BASE, moduleId: 'ajeno', unlocked: true })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listModuleAccess', () => {
  it('el primero abierto, el habilitado abierto con quién lo abrió, el resto bloqueado', async () => {
    db.module.findMany.mockResolvedValue([
      { id: 'mod-1', name: 'Introducción', position: 1 },
      { id: 'mod-2', name: 'Fundamentos', position: 2 },
      { id: 'mod-3', name: 'Consolidación', position: 3 },
    ]);
    db.enrollmentModule.findMany.mockResolvedValue([
      {
        moduleId: 'mod-2',
        unlockedAt: NOW,
        availableFrom: null,
        availableUntil: new Date('2026-12-16T04:59:59.999Z'),
        unlockedBy: { givenName: 'Ana', familyName: 'Pérez' },
      },
    ]);

    const result = await listModuleAccess({
      institutionId: 'inst-1',
      enrollmentId: 'enr-1',
      now: NOW,
    });

    expect(result.applies).toBe(true);
    expect(result.modules.map((m) => [m.moduleId, m.state, m.first])).toEqual([
      ['mod-1', 'OPEN', true],
      ['mod-2', 'OPEN', false],
      ['mod-3', 'LOCKED', false],
    ]);
    expect(result.modules[1]).toMatchObject({
      unlockedByName: 'Ana Pérez',
      availableFrom: null,
      availableUntil: '2026-12-15',
    });
  });

  it('en una cohorte FREE no aplica y todo está abierto', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      ...ENROLLMENT,
      cohort: { ...ENROLLMENT.cohort, progression: 'FREE' },
    });
    db.module.findMany.mockResolvedValue([
      { id: 'mod-1', name: 'A', position: 1 },
      { id: 'mod-2', name: 'B', position: 2 },
    ]);
    db.enrollmentModule.findMany.mockResolvedValue([]);

    const result = await listModuleAccess({
      institutionId: 'inst-1',
      enrollmentId: 'enr-1',
      now: NOW,
    });

    expect(result.applies).toBe(false);
    expect(result.modules.every((m) => m.state === 'OPEN')).toBe(true);
  });
});
