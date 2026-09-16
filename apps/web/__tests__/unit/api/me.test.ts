/** @jest-environment node */
/**
 * Tests for GET /api/me endpoint.
 */

import { NextRequest } from 'next/server';

// Mock functions - declared first for use in jest.mock
const mockNotificationCount = jest.fn();

// Mock request context
jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: jest.fn(),
}));

// Mock tenant client
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    notification: { count: mockNotificationCount },
  })),
}));

// Import mocked modules to configure them
import { getRequestContext } from '@/lib/authz/request-context';

const mockGetRequestContext = getRequestContext as jest.MockedFunction<typeof getRequestContext>;

// Import after mocks
import { GET } from '@/app/api/me/route';
import type { RequestContext } from '@/lib/authz/request-context';

// Helper to create minimal mock context - partial objects are OK for tests
function mockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    institution: {
      id: 'inst-1',
      slug: 'test',
      name: 'Test',
      supportEmail: 'test@test.com',
      supportPhone: null,
      dataPolicyVersion: '1',
      settings: null,
    },
    person: null,
    capabilities: new Map(),
    accountStatusByEnrollment: new Map(),
    requestId: 'req-1',
    ...overrides,
  } as RequestContext;
}

describe('GET /api/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(path = '/api/me') {
    return new NextRequest(new URL(path, 'http://localhost'));
  }

  it('returns 401 when not authenticated', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());

    const response = await GET(createRequest());
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns person data when authenticated', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Juan',
          familyName: 'Pérez',
          email: 'juan@example.com',
          authUserId: 'auth-1',
          memberships: [
            { personId: 'person-1', institutionId: 'inst-1', role: 'STUDENT', revokedAt: null },
            { personId: 'person-1', institutionId: 'inst-1', role: 'ADMIN', revokedAt: null },
          ],
          enrollments: [
            {
              id: 'enroll-1',
              studentId: 'person-1',
              cohortId: 'cohort-1',
              status: 'ACTIVE',
              isMinorAtEnrollment: false,
              accessUntil: new Date('2025-12-31'),
              payerType: 'PERSON',
            },
          ],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([
          ['lesson.read', [{ cohortId: 'cohort-1' }]],
          ['institution.manage', [{ institution: true }]],
        ]),
        accountStatusByEnrollment: new Map([['enroll-1', 'CURRENT']]),
      })
    );
    mockNotificationCount.mockResolvedValue(5);

    const response = await GET(createRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.person.id).toBe('person-1');
    expect(body.data.person.givenName).toBe('Juan');
    expect(body.data.person.familyName).toBe('Pérez');
    expect(body.data.person.email).toBe('juan@example.com');
    expect(body.data.roles).toContain('STUDENT');
    expect(body.data.roles).toContain('ADMIN');
    expect(body.data.enrollments).toHaveLength(1);
    expect(body.data.enrollments[0].id).toBe('enroll-1');
    expect(body.data.enrollments[0].accountStatus).toBe('CURRENT');
    expect(body.data.capabilities['lesson.read']).toBeDefined();
    expect(body.data.capabilities['institution.manage']).toBeDefined();
    expect(body.data.unreadNotifications).toBe(5);
  });

  it('does not include answerKey or other sensitive fields', async () => {
    // Note: documentNumber, birthDate, authUserId are not in ResolvedPerson
    // (only visible through the full Person model). This test verifies they don't leak.
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Ana',
          familyName: 'García',
          email: 'ana@example.com',
          authUserId: 'auth-user-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
      })
    );
    mockNotificationCount.mockResolvedValue(0);

    const response = await GET(createRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    // Should not include sensitive fields
    expect(body.data.person.documentNumber).toBeUndefined();
    expect(body.data.person.birthDate).toBeUndefined();
    expect(body.data.person.authUserId).toBeUndefined();
    // answerKey check - this is a security requirement from the criteria
    expect(JSON.stringify(body)).not.toContain('answerKey');
  });

  it('filters out revoked memberships from roles', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Carlos',
          familyName: 'López',
          email: 'carlos@example.com',
          authUserId: 'auth-1',
          memberships: [
            { personId: 'person-1', institutionId: 'inst-1', role: 'STUDENT', revokedAt: null },
            {
              personId: 'person-1',
              institutionId: 'inst-1',
              role: 'ADMIN',
              revokedAt: new Date('2024-01-01'),
            },
          ],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
      })
    );
    mockNotificationCount.mockResolvedValue(0);

    const response = await GET(createRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.roles).toContain('STUDENT');
    expect(body.data.roles).not.toContain('ADMIN');
  });
});
