/** @jest-environment node */
/**
 * Habilitación de componentes por matrícula (3/10): habilitar crea la fila, audita y avisa;
 * repetir no hace nada; bloquear borra y audita; en FREE no aplica.
 */

const mockNotify = jest.fn();
const mockCloseRequests = jest.fn();

const tx = {
  enrollmentModule: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  enrollmentLesson: { create: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  ...tx,
  enrollment: { findFirst: jest.fn() },
  module: { findFirst: jest.fn(), findMany: jest.fn() },
  enrollmentModule: { ...tx.enrollmentModule, findFirst: jest.fn(), findMany: jest.fn() },
  enrollmentLesson: { ...tx.enrollmentLesson, findFirst: jest.fn(), findMany: jest.fn() },
  lesson: { findFirst: jest.fn() },
  lessonAssignment: { findMany: jest.fn() },
  accessRequest: { findMany: jest.fn() },
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

import {
  listModuleAccess,
  setLessonAccess,
  setModuleAccess,
} from '@/features/cohorts/server/module-access.service';

const NOW = new Date('2026-10-03T15:00:00.000Z');
const ENROLLMENT = {
  id: 'enr-1',
  studentId: 'stu-1',
  cohortId: 'coh-1',
  startsAtModule: null,
  // Programa gratis: las reglas de antes del 24/11 (el primero abierto).
  cohort: { programId: 'prog-1', progression: 'LINEAR', program: { pricing: 'FREE' } },
};
const BASE = { institutionId: 'inst-1', actorId: 'staff-1', enrollmentId: 'enr-1', now: NOW };

beforeEach(() => {
  jest.clearAllMocks();
  db.enrollment.findFirst.mockResolvedValue(ENROLLMENT);
  db.module.findFirst.mockResolvedValue({ id: 'mod-2', name: 'Fundamentos' });
  db.enrollmentModule.findFirst.mockResolvedValue(null);
  tx.enrollmentModule.create.mockResolvedValue({ id: 'em-1' });
  tx.enrollmentModule.update.mockResolvedValue({ id: 'em-1' });
  db.accessRequest.findMany.mockResolvedValue([]);
});

// 20/11: un componente con cuota espera a esa cuota, también el primero; nunca para un menor.
describe('listModuleAccess con etapas por cuota', () => {
  const installments = [
    { position: 1, amount: { toNumber: () => 95000 }, status: 'OPEN', unlockModuleIds: ['mod-1'] },
  ];
  beforeEach(() => {
    db.module.findMany.mockResolvedValue([{ id: 'mod-1', name: 'Fundamentos', position: 1 }]);
    db.enrollmentModule.findMany.mockResolvedValue([]);
  });

  it('el primero queda bloqueado hasta que se pague su cuota', async () => {
    db.enrollment.findFirst.mockResolvedValue({ ...ENROLLMENT, paymentPlan: { installments } });

    const { modules } = await listModuleAccess(BASE);
    expect(modules[0]).toMatchObject({ first: false, state: 'LOCKED', installmentPosition: 1 });
  });

  it('a un menor no se le bloquea por cuota', async () => {
    db.enrollment.findFirst.mockResolvedValue({
      ...ENROLLMENT,
      isMinorAtEnrollment: true,
      paymentPlan: { installments },
    });

    const { modules } = await listModuleAccess(BASE);
    expect(modules[0]).toMatchObject({ first: true, state: 'OPEN', installmentPosition: null });
  });
});

describe('setModuleAccess', () => {
  // 6/10: si el estudiante lo había pedido, la solicitud queda hecha en la misma transacción.
  it('habilitar cierra la solicitud abierta de ese componente', async () => {
    await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: true });

    expect(mockCloseRequests).toHaveBeenCalledWith(
      tx,
      { kind: 'UNLOCK', enrollmentId: 'enr-1', moduleId: 'mod-2' },
      { actorId: 'staff-1', now: NOW }
    );
  });

  it('bloquear no toca las solicitudes', async () => {
    db.enrollmentModule.findFirst.mockResolvedValue({
      id: 'em-1',
      availableFrom: null,
      availableUntil: null,
    });
    await setModuleAccess({ ...BASE, moduleId: 'mod-2', unlocked: false });

    expect(mockCloseRequests).not.toHaveBeenCalled();
  });

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

  it('dice cuándo pidió el estudiante el componente bloqueado (6/10)', async () => {
    db.module.findMany.mockResolvedValue([
      { id: 'mod-1', name: 'Fundamentos', position: 1 },
      { id: 'mod-2', name: 'Consolidación', position: 2 },
    ]);
    db.enrollmentModule.findMany.mockResolvedValue([]);
    db.accessRequest.findMany.mockResolvedValue([{ moduleId: 'mod-2', createdAt: NOW }]);

    const result = await listModuleAccess({
      institutionId: 'inst-1',
      enrollmentId: 'enr-1',
      now: NOW,
    });

    expect(db.accessRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollmentId: 'enr-1', kind: 'UNLOCK', status: 'PENDING' },
      })
    );
    expect(result.modules.map((m) => m.requestedAt)).toEqual([null, NOW.toISOString()]);
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

// 24/11: programa de pago y adulto, todo cerrado; se abre tema por tema.
describe('cerrado por defecto', () => {
  const PAID = {
    ...ENROLLMENT,
    isMinorAtEnrollment: false,
    cohort: { ...ENROLLMENT.cohort, progression: 'FREE', program: { pricing: 'PAID' } },
  };
  beforeEach(() => {
    db.enrollment.findFirst.mockResolvedValue(PAID);
    db.module.findMany.mockResolvedValue([
      { id: 'mod-1', name: 'A', position: 1 },
      { id: 'mod-2', name: 'B', position: 2 },
    ]);
    db.enrollmentModule.findMany.mockResolvedValue([]);
    db.lessonAssignment.findMany.mockResolvedValue([
      { lesson: { id: 'l-1', title: 'Uno', moduleId: 'mod-1', position: 1 }, progress: [] },
      { lesson: { id: 'l-2', title: 'Dos', moduleId: 'mod-1', position: 2 }, progress: [{}] },
      { lesson: { id: 'l-3', title: 'Tres', moduleId: 'mod-2', position: 1 }, progress: [] },
    ]);
    db.enrollmentLesson.findMany.mockResolvedValue([{ lessonId: 'l-1' }]);
    db.lesson.findFirst.mockResolvedValue({ id: 'l-3', title: 'Tres' });
    db.enrollmentLesson.findFirst.mockResolvedValue(null);
    tx.enrollmentLesson.create.mockResolvedValue({ id: 'el-1' });
    tx.enrollmentLesson.delete.mockResolvedValue({ id: 'el-1' });
  });

  it('aplica aunque la cohorte sea libre: todo bloqueado, también el primero, con sus temas', async () => {
    const result = await listModuleAccess(BASE);

    expect(result).toMatchObject({ applies: true, closed: true });
    expect(result.modules.map((m) => [m.state, m.first])).toEqual([
      ['LOCKED', false],
      ['LOCKED', false],
    ]);
    expect(result.modules[0]!.lessons).toEqual([
      { lessonId: 'l-1', title: 'Uno', position: 1, unlocked: true, started: false },
      { lessonId: 'l-2', title: 'Dos', position: 2, unlocked: false, started: true },
    ]);
  });

  it('un menor sigue con las reglas de antes y sin temas', async () => {
    db.enrollment.findFirst.mockResolvedValue({ ...PAID, isMinorAtEnrollment: true });
    const result = await listModuleAccess(BASE);

    expect(result.closed).toBe(false);
    expect(result.modules.every((m) => m.state === 'OPEN' && m.lessons.length === 0)).toBe(true);
  });

  it('abrir un tema crea la fila, audita y avisa; repetir no hace nada', async () => {
    expect(await setLessonAccess({ ...BASE, lessonId: 'l-3', unlocked: true })).toEqual({
      changed: true,
    });
    expect(tx.enrollmentLesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentId: 'enr-1',
          lessonId: 'l-3',
          unlockedById: 'staff-1',
        }),
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'enrollment_lesson', action: 'unlock' }),
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        personId: 'stu-1',
        dedupeKey: 'lesson_unlocked:enr-1:l-3:2026-10-03',
      })
    );

    jest.clearAllMocks();
    db.enrollmentLesson.findFirst.mockResolvedValue({ id: 'el-1' });
    expect(await setLessonAccess({ ...BASE, lessonId: 'l-3', unlocked: true })).toEqual({
      changed: false,
    });
    expect(tx.enrollmentLesson.create).not.toHaveBeenCalled();
  });

  it('cerrar borra la fila y audita `lock` sin avisar', async () => {
    db.enrollmentLesson.findFirst.mockResolvedValue({ id: 'el-1' });
    await setLessonAccess({ ...BASE, lessonId: 'l-3', unlocked: false });

    expect(tx.enrollmentLesson.delete).toHaveBeenCalledWith({
      where: { id: 'el-1' },
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'lock' }) })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('un tema de otro programa no existe para esta matrícula', async () => {
    db.lesson.findFirst.mockResolvedValue(null);
    await expect(
      setLessonAccess({ ...BASE, lessonId: 'ajeno', unlocked: true })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
