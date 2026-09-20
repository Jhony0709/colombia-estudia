/** @jest-environment node */
/**
 * Tests for granting and revoking roles.
 * SSOT: plan/06-cohortes-y-personas.md:35, docs/estado.md §12b
 */

const tx = {
  person: { findFirst: jest.fn() },
  membership: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...tx,
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  })),
}));

import { grantRole, revokeRole } from '@/features/people/server/people.service';

const BASE = { institutionId: 'inst-1', actorId: 'actor-1', personId: 'person-1' };

beforeEach(() => jest.clearAllMocks());

describe('grantRole', () => {
  it('creates the membership and audits it', async () => {
    tx.person.findFirst.mockResolvedValue({ id: 'person-1' });
    tx.membership.findFirst.mockResolvedValue(null);

    const result = await grantRole({ ...BASE, role: 'STUDENT' });

    expect(result).toEqual({ granted: true });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: { institutionId: 'inst-1', personId: 'person-1', role: 'STUDENT' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'membership',
        action: 'granted',
        after: { role: 'STUDENT' },
      }),
    });
  });

  it('is idempotent: granting a role the person already holds writes nothing', async () => {
    tx.person.findFirst.mockResolvedValue({ id: 'person-1' });
    tx.membership.findFirst.mockResolvedValue({ id: 'membership-1' });

    const result = await grantRole({ ...BASE, role: 'STUDENT' });

    expect(result).toEqual({ granted: false });
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a person from another institution', async () => {
    tx.person.findFirst.mockResolvedValue(null);

    await expect(grantRole({ ...BASE, role: 'STUDENT' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('revokeRole', () => {
  it('revokes and audits', async () => {
    tx.membership.findMany.mockResolvedValue([{ id: 'membership-1' }]);

    const result = await revokeRole({ ...BASE, role: 'INSTRUCTOR' });

    expect(result).toEqual({ revoked: true });
    expect(tx.membership.updateMany).toHaveBeenCalledWith({
      where: { personId: 'person-1', role: 'INSTRUCTOR', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'revoked', before: { role: 'INSTRUCTOR' } }),
    });
  });

  it('does nothing when the person does not hold the role', async () => {
    tx.membership.findMany.mockResolvedValue([]);

    const result = await revokeRole({ ...BASE, role: 'INSTRUCTOR' });

    expect(result).toEqual({ revoked: false });
    expect(tx.membership.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to revoke the last ADMIN of the institution', async () => {
    tx.membership.findMany.mockResolvedValue([{ id: 'membership-1' }]);
    tx.membership.count.mockResolvedValue(1);

    await expect(revokeRole({ ...BASE, role: 'ADMIN' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(tx.membership.updateMany).not.toHaveBeenCalled();
  });

  it('allows revoking an ADMIN while another one remains', async () => {
    tx.membership.findMany.mockResolvedValue([{ id: 'membership-1' }]);
    tx.membership.count.mockResolvedValue(2);

    const result = await revokeRole({ ...BASE, role: 'ADMIN' });

    expect(result).toEqual({ revoked: true });
    expect(tx.membership.updateMany).toHaveBeenCalled();
  });
});
