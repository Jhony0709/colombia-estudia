/** @jest-environment node */
/**
 * Tests for withCapability wrapper.
 */

// Mock domain to avoid loading unified (ES module)
// Implement scopeAllows logic inline for tests
jest.mock('@colombia-estudia/domain', () => ({
  scopeAllows: jest.fn((userScopes: unknown[], resourceScope: Record<string, unknown>) => {
    // Simplified implementation for tests
    const scopes = userScopes as Array<Record<string, unknown>>;
    for (const scope of scopes) {
      // Institution scope covers everything
      if ('institution' in scope && scope.institution === true) {
        return true;
      }
      // Cohort scope
      if ('cohortId' in scope && 'cohortId' in resourceScope) {
        if (scope.cohortId === resourceScope.cohortId) {
          return true;
        }
      }
    }
    return false;
  }),
}));

// Mock request context
jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: jest.fn(),
}));

// Mock next/navigation for requireCapability
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Import mocked modules to access the mock functions
import { getRequestContext } from '@/lib/authz/request-context';
import { redirect } from 'next/navigation';

const mockGetRequestContext = getRequestContext as jest.MockedFunction<typeof getRequestContext>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

// Import after mocks
import { withCapability, requireCapability } from '@/lib/authz/with-capability';
import { APIError } from '@/lib/core/errors';
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

describe('withCapability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRequest = new Request('http://localhost/api/test');

  it('throws UNAUTHENTICATED when person is null', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());

    const handler = withCapability('lesson.read')(async () => ({ ok: true }));

    await expect(handler(mockRequest, {})).rejects.toThrow(APIError);
    await expect(handler(mockRequest, {})).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('throws INSUFFICIENT_CAPABILITY when capability is missing', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map(), // No capabilities
      })
    );

    const handler = withCapability('lesson.read')(async () => ({ ok: true }));

    await expect(handler(mockRequest, {})).rejects.toThrow(APIError);
    await expect(handler(mockRequest, {})).rejects.toMatchObject({
      code: 'INSUFFICIENT_CAPABILITY',
    });
  });

  it('executes handler when capability exists (no resource)', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['lesson.read', [{ institution: true }]]]),
      })
    );

    const handler = withCapability('lesson.read')(async (ctx) => ({
      personId: ctx.person?.id,
    }));

    const result = await handler(mockRequest, {});
    expect(result).toEqual({ personId: 'person-1' });
  });

  it('throws NOT_FOUND when resource is not found', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['lesson.read', [{ cohortId: 'cohort-1' }]]]),
      })
    );

    const handler = withCapability('lesson.read', {
      load: async () => null, // Resource not found
      // scopeOf is never called when load returns null, but TS needs the type
      scopeOf: (r: { cohortId: string }) => ({ cohortId: r.cohortId }),
    })(async () => ({ ok: true }));

    await expect(handler(mockRequest, {})).rejects.toThrow(APIError);
    await expect(handler(mockRequest, {})).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws INSUFFICIENT_CAPABILITY when resource is out of scope (same institution, other cohort)', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['lesson.read', [{ cohortId: 'cohort-A' }]]]),
      })
    );

    const resource = { id: 'lesson-1', cohortId: 'cohort-B' }; // Different cohort!

    const handler = withCapability('lesson.read', {
      load: async () => resource,
      scopeOf: (r) => ({ cohortId: r.cohortId }),
    })(async () => ({ ok: true }));

    await expect(handler(mockRequest, {})).rejects.toThrow(APIError);
    await expect(handler(mockRequest, {})).rejects.toMatchObject({
      code: 'INSUFFICIENT_CAPABILITY',
    });
  });

  it('executes handler when resource is within scope', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['lesson.read', [{ cohortId: 'cohort-A' }]]]),
      })
    );

    const resource = { id: 'lesson-1', cohortId: 'cohort-A' }; // Same cohort

    const handler = withCapability('lesson.read', {
      load: async () => resource,
      scopeOf: (r) => ({ cohortId: r.cohortId }),
    })(async (ctx, res) => ({ lessonId: res.id }));

    const result = await handler(mockRequest, {});
    expect(result).toEqual({ lessonId: 'lesson-1' });
  });

  it('institution scope covers any resource', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['lesson.read', [{ institution: true }]]]),
      })
    );

    const resource = { id: 'lesson-1', cohortId: 'any-cohort' };

    const handler = withCapability('lesson.read', {
      load: async () => resource,
      scopeOf: (r) => ({ cohortId: r.cohortId }),
    })(async (ctx, res) => ({ lessonId: res.id }));

    const result = await handler(mockRequest, {});
    expect(result).toEqual({ lessonId: 'lesson-1' });
  });
});

describe('requireCapability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to /auth/login when person is null', async () => {
    mockGetRequestContext.mockResolvedValue(mockContext());
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(requireCapability('institution.manage')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/auth/login');
  });

  it('redirects to / when capability is missing', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
      })
    );
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(requireCapability('institution.manage')).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('does not redirect when capability exists', async () => {
    mockGetRequestContext.mockResolvedValue(
      mockContext({
        person: {
          id: 'person-1',
          givenName: 'Test',
          familyName: 'User',
          email: 'test@test.com',
          authUserId: 'auth-1',
          memberships: [],
          enrollments: [],
          guardianships: [],
          partnerContacts: [],
        },
        capabilities: new Map([['institution.manage', [{ institution: true }]]]),
      })
    );

    await requireCapability('institution.manage');
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
