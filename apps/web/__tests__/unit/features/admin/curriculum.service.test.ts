/** @jest-environment node */
/**
 * Tests for the curriculum service.
 * SSOT: plan/06-cohortes-y-personas.md:19-22, docs/estado.md §11b
 *
 * The interesting part is `moveModule`: `Module` carries `@@unique([programId, position])`,
 * so a naive two-update swap collides mid-transaction.
 */

const tx = {
  program: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  module: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  subject: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  cohort: { count: jest.fn() },
  auditLog: { create: jest.fn() },
};

const mockIsUniqueViolation = jest.fn().mockReturnValue(false);

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...tx,
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  })),
}));

jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => mockIsUniqueViolation(err),
}));

import {
  moveModule,
  createModule,
  createProgram,
  archiveProgram,
} from '@/features/admin/server/curriculum.service';

const BASE = { institutionId: 'inst-1', actorId: 'person-1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockIsUniqueViolation.mockReturnValue(false);
});

describe('moveModule', () => {
  it('swaps through a temporary position so the unique constraint never collides', async () => {
    tx.module.findFirst
      .mockResolvedValueOnce({ id: 'mod-b', programId: 'prog-1', position: 2 })
      .mockResolvedValueOnce({ id: 'mod-a', position: 1 });

    const result = await moveModule({ ...BASE, moduleId: 'mod-b', direction: 'up' });

    expect(result).toEqual({ id: 'mod-b', position: 1 });
    expect(tx.module.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 'mod-b' }, data: { position: -1 } },
      { where: { id: 'mod-a' }, data: { position: 2 } },
      { where: { id: 'mod-b' }, data: { position: 1 } },
    ]);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'module',
        action: 'reordered',
        before: { position: 2 },
        after: { position: 1 },
      }),
    });
  });

  it('looks for the neighbour above when moving up and below when moving down', async () => {
    tx.module.findFirst
      .mockResolvedValueOnce({ id: 'mod-a', programId: 'prog-1', position: 1 })
      .mockResolvedValueOnce({ id: 'mod-b', position: 2 });

    await moveModule({ ...BASE, moduleId: 'mod-a', direction: 'down' });

    expect(tx.module.findFirst.mock.calls[1][0]).toMatchObject({
      where: { programId: 'prog-1', archivedAt: null, position: { gt: 1 } },
      orderBy: { position: 'asc' },
    });
  });

  it('refuses to move past the edge of the list', async () => {
    tx.module.findFirst
      .mockResolvedValueOnce({ id: 'mod-a', programId: 'prog-1', position: 1 })
      .mockResolvedValueOnce(null);

    await expect(moveModule({ ...BASE, moduleId: 'mod-a', direction: 'up' })).rejects.toMatchObject(
      { code: 'CONFLICT' }
    );
    expect(tx.module.update).not.toHaveBeenCalled();
  });

  it('rejects a module from another institution as not found', async () => {
    tx.module.findFirst.mockResolvedValueOnce(null);

    await expect(moveModule({ ...BASE, moduleId: 'mod-x', direction: 'up' })).rejects.toMatchObject(
      { code: 'NOT_FOUND' }
    );
  });
});

describe('createModule', () => {
  it('takes the next position from the maximum, not from the visible count', async () => {
    tx.program.findFirst.mockResolvedValue({ id: 'prog-1' });
    // An archived module still holds position 7: the unique constraint covers every row.
    tx.module.findFirst.mockResolvedValue({ position: 7 });
    tx.module.create.mockResolvedValue({ id: 'mod-new', position: 8 });

    await createModule({ ...BASE, programId: 'prog-1', name: 'Módulo nuevo' });

    expect(tx.module.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 8, name: 'Módulo nuevo' }),
      })
    );
  });

  it('starts at 1 for the first module', async () => {
    tx.program.findFirst.mockResolvedValue({ id: 'prog-1' });
    tx.module.findFirst.mockResolvedValue(null);
    tx.module.create.mockResolvedValue({ id: 'mod-new', position: 1 });

    await createModule({ ...BASE, programId: 'prog-1', name: 'Primero' });

    expect(tx.module.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 1 }) })
    );
  });
});

describe('createProgram', () => {
  it('turns a duplicate code into CONFLICT instead of a 500', async () => {
    const p2002 = new Error('Unique constraint failed');
    tx.program.create.mockRejectedValue(p2002);
    mockIsUniqueViolation.mockReturnValue(true);

    await expect(
      createProgram({
        ...BASE,
        data: { code: 'DEMO', name: 'Demo', description: null, defaultAccessDays: 300 },
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lets an unrelated failure through untouched', async () => {
    tx.program.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      createProgram({
        ...BASE,
        data: { code: 'DEMO', name: 'Demo', description: null, defaultAccessDays: 300 },
      })
    ).rejects.toThrow('connection lost');
  });
});

describe('archiveProgram', () => {
  it('refuses while the program still has cohorts', async () => {
    tx.program.findFirst.mockResolvedValue({ id: 'prog-1' });
    tx.cohort.count.mockResolvedValue(2);

    await expect(archiveProgram({ ...BASE, programId: 'prog-1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(tx.program.update).not.toHaveBeenCalled();
  });

  it('archives when nothing depends on it', async () => {
    tx.program.findFirst.mockResolvedValue({ id: 'prog-1' });
    tx.cohort.count.mockResolvedValue(0);

    await archiveProgram({ ...BASE, programId: 'prog-1' });

    expect(tx.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity: 'program', action: 'archived' }),
    });
  });
});
