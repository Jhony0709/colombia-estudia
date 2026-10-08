/** @jest-environment node */
/**
 * Las solicitudes del estudiante (6/10): pedir dos veces no duplica ni vuelve a avisar, solo se
 * pide lo que la ruta muestra bloqueado, y se cierran solas o se descartan con auditoría.
 * SSOT: features/requests/server/requests.service.ts.
 */

const tx = {
  accessRequest: { update: jest.fn(), updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  accessRequest: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  person: { findFirst: jest.fn() },
  $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
};
const mockNotifyMany = jest.fn();
const mockNotify = jest.fn();
const mockGetCohortOutline = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: jest.fn(() => db) }));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  notify: (...args: unknown[]) => mockNotify(...args),
  staffPersonIds: jest.fn(async () => ['staff-1']),
}));
jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: (...args: unknown[]) => mockGetCohortOutline(...args),
}));

import {
  closeRequests,
  dismissRequest,
  listMyPendingRequests,
  openEnrollRequest,
  requestUnlock,
} from '@/features/requests/server/requests.service';

const NOW = new Date('2026-10-06T15:00:00.000Z');
const ENROLL = {
  institutionId: 'inst-1',
  personId: 'p-1',
  cohortId: 'c-1',
  moduleId: 'm-1',
  courseName: 'Bachillerato por ciclos',
  cohortCode: 'BACH-2026-2',
  personName: 'Ana Ruiz',
  now: NOW,
};

const outline = (state: 'OPEN' | 'LOCKED' | 'NOT_YET', gate: unknown = null) => ({
  gate,
  enrollmentId: 'e-1',
  cohort: { id: 'c-1', code: 'BACH-2026-2' },
  modules: [
    { id: 'm-1', name: 'Fundamentos', access: { state: 'OPEN' } },
    { id: 'm-2', name: 'Consolidación', access: { state } },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  db.accessRequest.findFirst.mockResolvedValue(null);
  db.accessRequest.create.mockResolvedValue({ id: 'r-1', createdAt: NOW });
  db.person.findFirst.mockResolvedValue({ givenName: 'Ana', familyName: 'Ruiz' });
});

describe('openEnrollRequest', () => {
  it('creates the request and tells operations once, pointing at the inbox', async () => {
    const result = await openEnrollRequest(ENROLL);

    expect(result).toEqual({ id: 'r-1', createdAt: NOW.toISOString(), already: false });
    expect(db.accessRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'ENROLL', enrollmentId: null, personId: 'p-1' }),
      })
    );
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['staff-1'],
      expect.objectContaining({
        type: 'enrollment_requested',
        href: '/solicitudes',
        dedupeKey: 'access_request:r-1',
        body: 'Ana Ruiz quiere inscribirse en Bachillerato por ciclos (BACH-2026-2).',
      })
    );
  });

  it('asking again returns the open one and does not tell anyone again', async () => {
    db.accessRequest.findFirst.mockResolvedValue({ id: 'r-0', createdAt: NOW });

    const result = await openEnrollRequest(ENROLL);

    expect(result).toEqual({ id: 'r-0', createdAt: NOW.toISOString(), already: true });
    expect(db.accessRequest.create).not.toHaveBeenCalled();
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });

  it('two clicks at once: the unique index wins and the second gets the first', async () => {
    db.accessRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'r-0', createdAt: NOW });
    db.accessRequest.create.mockRejectedValue({ unique: true });

    const result = await openEnrollRequest(ENROLL);

    expect(result.already).toBe(true);
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });
});

describe('requestUnlock', () => {
  const BASE = { institutionId: 'inst-1', personId: 'p-1', enrollmentId: 'e-1', now: NOW };

  it('only the next locked component, not one further ahead', async () => {
    mockGetCohortOutline.mockResolvedValue({
      ...outline('LOCKED'),
      modules: [
        { id: 'm-1', name: 'Fundamentos', access: { state: 'OPEN' } },
        { id: 'm-2', name: 'Consolidación', access: { state: 'LOCKED' } },
        { id: 'm-3', name: 'Profundización', access: { state: 'LOCKED' } },
      ],
    });

    await expect(requestUnlock({ ...BASE, moduleId: 'm-3' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(db.accessRequest.create).not.toHaveBeenCalled();
  });

  it('only a component the route shows LOCKED', async () => {
    mockGetCohortOutline.mockResolvedValue(outline('NOT_YET'));

    await expect(requestUnlock({ ...BASE, moduleId: 'm-2' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(db.accessRequest.create).not.toHaveBeenCalled();
  });

  it('not from an enrollment that cannot be studied today', async () => {
    mockGetCohortOutline.mockResolvedValue(outline('LOCKED', { kind: 'WITHDRAWN' }));

    await expect(requestUnlock({ ...BASE, moduleId: 'm-2' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('a component that is not in the route is NOT_FOUND', async () => {
    mockGetCohortOutline.mockResolvedValue(outline('LOCKED'));

    await expect(requestUnlock({ ...BASE, moduleId: 'm-9' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('opens an UNLOCK request on the enrollment and tells operations', async () => {
    mockGetCohortOutline.mockResolvedValue(outline('LOCKED'));

    await requestUnlock({ ...BASE, moduleId: 'm-2' });

    expect(mockGetCohortOutline).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      personId: 'p-1',
      enrollmentId: 'e-1',
      now: NOW,
    });
    expect(db.accessRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'UNLOCK',
          cohortId: 'c-1',
          moduleId: 'm-2',
          enrollmentId: 'e-1',
        }),
      })
    );
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['staff-1'],
      expect.objectContaining({
        type: 'unlock_requested',
        body: 'Ana Ruiz pide habilitar Consolidación (BACH-2026-2).',
      })
    );
  });
});

describe('closeRequests', () => {
  it('marks the open ones done, with who and when', async () => {
    tx.accessRequest.updateMany.mockResolvedValue({ count: 1 });

    const closed = await closeRequests(
      tx as unknown as Parameters<typeof closeRequests>[0],
      { kind: 'UNLOCK', enrollmentId: 'e-1', moduleId: 'm-2' },
      { actorId: 'staff-1', now: NOW }
    );

    expect(closed).toBe(1);
    expect(tx.accessRequest.updateMany).toHaveBeenCalledWith({
      where: { kind: 'UNLOCK', enrollmentId: 'e-1', moduleId: 'm-2', status: 'PENDING' },
      data: { status: 'DONE', resolvedAt: NOW, resolvedById: 'staff-1' },
    });
  });
});

describe('dismissRequest', () => {
  it('dismisses an open one, audits it and tells the student', async () => {
    db.accessRequest.findFirst.mockResolvedValue({
      id: 'r-1',
      status: 'PENDING',
      kind: 'ENROLL',
      personId: 'p-1',
      module: { name: 'Fundamentos' },
      cohort: { program: { name: 'Bachillerato por ciclos' } },
    });

    await dismissRequest({
      institutionId: 'inst-1',
      actorId: 'staff-1',
      requestId: 'r-1',
      now: NOW,
    });

    expect(tx.accessRequest.update).toHaveBeenCalledWith({
      where: { id: 'r-1' },
      data: { status: 'DISMISSED', resolvedAt: NOW, resolvedById: 'staff-1' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'access_request', action: 'dismissed' }),
      })
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({
        personId: 'p-1',
        type: 'request_dismissed',
        body: expect.stringContaining('Bachillerato por ciclos'),
      })
    );
  });

  it('a closed one cannot be dismissed', async () => {
    db.accessRequest.findFirst.mockResolvedValue({ id: 'r-1', status: 'DONE' });

    await expect(
      dismissRequest({ institutionId: 'inst-1', actorId: 'staff-1', requestId: 'r-1', now: NOW })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('listMyPendingRequests', () => {
  it('splits what the person asked by course and by component of an enrollment', async () => {
    db.accessRequest.findMany.mockResolvedValue([
      { kind: 'ENROLL', cohortId: 'c-9', moduleId: 'm-9', enrollmentId: null, createdAt: NOW },
      { kind: 'UNLOCK', cohortId: 'c-1', moduleId: 'm-2', enrollmentId: 'e-1', createdAt: NOW },
    ]);

    const result = await listMyPendingRequests({ institutionId: 'inst-1', personId: 'p-1' });

    expect(result).toEqual({
      enroll: { 'c-9': { at: NOW.toISOString(), moduleId: 'm-9' } },
      unlock: { 'e-1:m-2': NOW.toISOString() },
    });
  });
});
