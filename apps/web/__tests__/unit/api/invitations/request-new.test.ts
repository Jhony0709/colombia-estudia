/** @jest-environment node */
/**
 * Tests for POST /api/invitations/[token]/request-new endpoint.
 * SSOT: docs/estado.md §9c
 */

import { NextRequest } from 'next/server';

// Mock server-only
jest.mock('server-only', () => ({}));

// Mock invitation token
const mockHashToken = jest.fn();
jest.mock('@/lib/auth/invitation-token', () => ({
  hashToken: (...args: unknown[]) => mockHashToken(...args),
}));

// Mock prisma
const mockPrismaInvitationFindFirst = jest.fn();
const mockPrismaMembershipFindMany = jest.fn();
const mockPrismaNotificationCreateMany = jest.fn();
jest.mock('@/lib/db/tenant', () => ({
  prisma: {
    invitation: { findFirst: (...args: unknown[]) => mockPrismaInvitationFindFirst(...args) },
    membership: { findMany: (...args: unknown[]) => mockPrismaMembershipFindMany(...args) },
    notification: { createMany: (...args: unknown[]) => mockPrismaNotificationCreateMany(...args) },
  },
}));

// Mock bogotaDate
jest.mock('@colombia-estudia/domain', () => ({
  bogotaDate: () => '2025-01-01',
}));

// Import after mocks
import { POST } from '@/app/api/invitations/[token]/request-new/route';

describe('POST /api/invitations/[token]/request-new', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHashToken.mockReturnValue('hashed-token');
    mockPrismaNotificationCreateMany.mockResolvedValue({ count: 0 });
  });

  function createRequest(token: string) {
    return new NextRequest(new URL(`/api/invitations/${token}/request-new`, 'http://localhost'), {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });
  }

  async function callEndpoint(token: string) {
    return POST(createRequest(token), { params: Promise.resolve({ token }) });
  }

  it('always returns 200 regardless of token validity', async () => {
    // Token doesn't exist
    mockPrismaInvitationFindFirst.mockResolvedValue(null);

    const response = await callEndpoint('nonexistent-token');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.message).toBe('Solicitud enviada');
  });

  it('returns 200 for valid token (does not reveal existence)', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([{ personId: 'admin-1' }]);

    const response = await callEndpoint('valid-token');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.message).toBe('Solicitud enviada');
  });

  it('creates notifications for ADMIN and OPERATIONS members', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([
      { personId: 'admin-1' },
      { personId: 'ops-1' },
    ]);

    await callEndpoint('valid-token');

    expect(mockPrismaMembershipFindMany).toHaveBeenCalledWith({
      where: {
        institutionId: 'inst-1',
        role: { in: ['ADMIN', 'OPERATIONS'] },
        revokedAt: null,
      },
      select: { personId: true },
    });

    expect(mockPrismaNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          institutionId: 'inst-1',
          personId: 'admin-1',
          type: 'reinvite_requested',
          dedupeKey: 'reinvite:person-1:2025-01-01',
        }),
        expect.objectContaining({
          institutionId: 'inst-1',
          personId: 'ops-1',
          type: 'reinvite_requested',
          dedupeKey: 'reinvite:person-1:2025-01-01',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('uses daily dedupeKey to prevent duplicates', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([{ personId: 'admin-1' }]);

    await callEndpoint('valid-token');

    const createManyCall = mockPrismaNotificationCreateMany.mock.calls[0][0];
    expect(createManyCall.data[0].dedupeKey).toBe('reinvite:person-1:2025-01-01');
    expect(createManyCall.skipDuplicates).toBe(true);
  });

  it('does not create notifications if no staff members found', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([]);

    await callEndpoint('valid-token');

    expect(mockPrismaNotificationCreateMany).not.toHaveBeenCalled();
  });

  it('includes person name and email in notification body', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'María', familyName: 'García', email: 'maria@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([{ personId: 'admin-1' }]);

    await callEndpoint('valid-token');

    const createManyCall = mockPrismaNotificationCreateMany.mock.calls[0][0];
    expect(createManyCall.data[0].body).toContain('María García');
    expect(createManyCall.data[0].body).toContain('maria@example.com');
  });

  it('includes href to the person page under /personas (routes.md:51)', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([{ personId: 'admin-1' }]);

    await callEndpoint('valid-token');

    const createManyCall = mockPrismaNotificationCreateMany.mock.calls[0][0];
    expect(createManyCall.data[0].href).toBe('/personas/person-1');
  });

  it('does not notify operations while the invitation is still pending and valid', async () => {
    mockPrismaInvitationFindFirst.mockResolvedValue({
      personId: 'person-1',
      institutionId: 'inst-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      person: { givenName: 'Juan', familyName: 'Pérez', email: 'juan@example.com' },
    });
    mockPrismaMembershipFindMany.mockResolvedValue([{ personId: 'admin-1' }]);

    const response = await callEndpoint('pending-token');

    expect(response.status).toBe(200);
    expect((await response.json()).data.message).toBe('Solicitud enviada');
    expect(mockPrismaNotificationCreateMany).not.toHaveBeenCalled();
  });
});
