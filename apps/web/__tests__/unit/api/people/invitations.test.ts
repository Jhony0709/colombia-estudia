/** @jest-environment node */
/**
 * Tests for POST /api/people/invitations endpoint.
 * SSOT: docs/estado.md §9c
 */

import { NextRequest } from 'next/server';

// Mock functions
const mockPrismaPersonFindUnique = jest.fn();
const mockPrismaInvitationUpdateMany = jest.fn();
const mockPrismaInvitationCreate = jest.fn();
const mockPrismaAuditLogCreate = jest.fn();
const mockMailerSend = jest.fn();

// Mock server-only
jest.mock('server-only', () => ({}));

// Mock request context
jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: jest.fn(),
}));

// Mock tenant client
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    person: { findUnique: mockPrismaPersonFindUnique },
    invitation: {
      updateMany: mockPrismaInvitationUpdateMany,
      create: mockPrismaInvitationCreate,
    },
    auditLog: { create: mockPrismaAuditLogCreate },
  })),
}));

// Mock invitation token
jest.mock('@/lib/auth/invitation-token', () => ({
  generateInvitationToken: () => ({
    token: 'test-token-abc123',
    hash: 'test-hash-abc123',
    expiresAt: new Date('2025-01-07'),
  }),
}));

/*
  Mock mailer.

  `isMailConfigured` no es decorado: `sendInvitation` lo llama para devolver `emailDelivered`,
  y de ahí sale el aviso de la ficha de la persona que distingue «invitación enviada» de «el
  enlace existe pero no salió ningún correo». Faltaba en este mock desde que se añadió ese
  campo, así que el camino feliz moría con «isMailConfigured is not a function» —los casos de
  400 y 409 pasaban porque lanzan antes de llegar ahí—.
*/
jest.mock('@/lib/mail', () => ({
  getMailer: () => ({ send: mockMailerSend }),
  isMailConfigured: () => true,
}));

jest.mock('@/lib/mail/templates/invitation', () => ({
  renderInvitationEmail: () => ({
    subject: 'Test Subject',
    html: '<p>Test HTML</p>',
    text: 'Test Text',
  }),
}));

// Import mocked modules
import { getRequestContext } from '@/lib/authz/request-context';

const mockGetRequestContext = getRequestContext as jest.MockedFunction<typeof getRequestContext>;

// Import after mocks
import { POST } from '@/app/api/people/invitations/route';
import type { RequestContext } from '@/lib/authz/request-context';

// Helper to create mock context
function mockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    institution: {
      id: 'inst-1',
      slug: 'test',
      name: 'Test Institution',
      supportEmail: 'support@test.com',
      supportPhone: null,
      dataPolicyVersion: '1',
      dataPolicyUrl: 'https://example.com/policy',
      settings: null,
    },
    person: {
      id: 'actor-1',
      givenName: 'Admin',
      familyName: 'User',
      email: 'admin@test.com',
      authUserId: 'auth-admin',
      memberships: [
        { personId: 'actor-1', institutionId: 'inst-1', role: 'ADMIN', revokedAt: null },
      ],
      enrollments: [],
      guardianships: [],
      partnerContacts: [],
    },
    capabilities: new Map([['people.manage', [{ institution: true }]]]),
    accountStatusByEnrollment: new Map(),
    requestId: 'req-1',
    aal: 'aal2',
    mfaPending: false,
    ...overrides,
  } as RequestContext;
}

describe('POST /api/people/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMailerSend.mockResolvedValue({ id: 'mail-123' });
    mockPrismaInvitationUpdateMany.mockResolvedValue({ count: 0 });
    mockPrismaInvitationCreate.mockResolvedValue({ id: 'inv-123' });
    mockPrismaAuditLogCreate.mockResolvedValue({});
  });

  function createRequest(body: object) {
    return new NextRequest(new URL('/api/people/invitations', 'http://localhost'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when not authenticated', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext({ person: null }));

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 without people.manage capability', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext({ capabilities: new Map() }));

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('INSUFFICIENT_CAPABILITY');
  });

  it('returns 404 when person does not exist', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockPrismaPersonFindUnique.mockResolvedValue(null);

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when person has no email', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockPrismaPersonFindUnique.mockResolvedValue({
      id: 'person-1',
      givenName: 'Test',
      email: null,
      authUserId: null,
    });

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when person already has authUserId', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockPrismaPersonFindUnique.mockResolvedValue({
      id: 'person-1',
      givenName: 'Test',
      email: 'test@example.com',
      authUserId: 'existing-auth-id',
    });

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('creates invitation, sends email, and returns invitationId', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockPrismaPersonFindUnique.mockResolvedValue({
      id: 'person-1',
      givenName: 'Test',
      email: 'test@example.com',
      authUserId: null,
    });

    const response = await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.invitationId).toBe('inv-123');
    // Que el correo saliera de verdad se dice; no se da por hecho.
    expect(body.data.emailDelivered).toBe(true);

    // Verify invalidation of existing invitations
    expect(mockPrismaInvitationUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        personId: 'cltest123456789012345',
        acceptedAt: null,
        expiresAt: expect.any(Object),
      }),
      data: expect.objectContaining({ expiresAt: expect.any(Date) }),
    });

    // Verify invitation created
    expect(mockPrismaInvitationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        personId: 'cltest123456789012345',
        institutionId: 'inst-1',
        tokenHash: 'test-hash-abc123',
        createdById: 'actor-1',
      }),
    });

    // Verify email sent
    expect(mockMailerSend).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
      text: 'Test Text',
    });

    // Verify audit log created
    expect(mockPrismaAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: 'inst-1',
        actorId: 'actor-1',
        entity: 'invitation',
        entityId: 'inv-123',
        action: 'sent',
      }),
    });
  });

  it('invalidates existing pending invitations with expiresAt = now', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockPrismaPersonFindUnique.mockResolvedValue({
      id: 'person-1',
      givenName: 'Test',
      email: 'test@example.com',
      authUserId: null,
    });

    const before = Date.now();
    await POST(createRequest({ personId: 'cltest123456789012345' }), {});
    const after = Date.now();

    // Verify the expiresAt is set to now (not epoch 0)
    const updateCall = mockPrismaInvitationUpdateMany.mock.calls[0][0];
    const expiresAt = updateCall.data.expiresAt.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before);
    expect(expiresAt).toBeLessThanOrEqual(after);
  });
});
