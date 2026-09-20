/** @jest-environment node */
/**
 * Tests for request context resolution.
 *
 * These tests mock all dependencies (headers, Supabase, Prisma, domain).
 */

// Mock React.cache - must come before imports
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: jest.fn((fn) => fn),
}));

// Mock next/headers
const mockGet = jest.fn();
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve({ get: mockGet })),
}));

// Mock next/navigation
const mockNotFound = jest.fn();
jest.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

// Mock institution cache
const mockResolveInstitution = jest.fn();
jest.mock('@/lib/authz/institution-cache', () => ({
  resolveInstitutionBySlug: mockResolveInstitution,
}));

// Mock Supabase
const mockGetSupabaseUser = jest.fn();
const mockGetAuthenticatorAssuranceLevel = jest.fn();
const mockCreateServerSupabaseClient = jest.fn(() => ({
  auth: {
    mfa: {
      getAuthenticatorAssuranceLevel: mockGetAuthenticatorAssuranceLevel,
    },
  },
}));
jest.mock('@/lib/auth/supabase-server', () => ({
  getSupabaseUser: mockGetSupabaseUser,
  createServerSupabaseClient: mockCreateServerSupabaseClient,
}));

// Mock tenant client
const mockFindUniquePerson = jest.fn();
const mockFindUniquePolicy = jest.fn();
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    person: { findUnique: mockFindUniquePerson },
    restrictionPolicy: { findUnique: mockFindUniquePolicy },
  })),
}));

// Mock domain functions
const mockDeriveAccountStatus = jest.fn((..._args: unknown[]) => 'CURRENT');
jest.mock('@colombia-estudia/domain', () => ({
  resolveCapabilities: jest.fn(() => new Map()),
  deriveAccountStatus: mockDeriveAccountStatus,
}));

const institution = {
  id: 'inst-1',
  slug: 'validaya',
  name: 'Valida YA',
  supportEmail: 'support@validaya.co',
  supportPhone: null,
  dataPolicyUrl: null,
  dataPolicyVersion: '1',
  settings: null,
};

describe('getRequestContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset React.cache by clearing module cache
    jest.resetModules();
    // Default MFA response (aal1)
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
    });
  });

  it('resolves the hardcoded tenant slug (decision 16/9), not the host', async () => {
    mockGet.mockReturnValue(null);
    mockResolveInstitution.mockResolvedValue(institution);
    mockGetSupabaseUser.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(mockResolveInstitution).toHaveBeenCalledWith('colombia-estudia');
    expect(ctx.institution.id).toBe('inst-1');
    expect(ctx.requestId).toBe('unknown');
  });

  it('throws (deployment error, not 404) when the tenant row does not exist', async () => {
    mockGet.mockReturnValue(null);
    mockResolveInstitution.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');

    await expect(getRequestContext()).rejects.toThrow('Institution "colombia-estudia" not found');
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it('returns anonymous context when user is not authenticated', async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === 'x-tenant-host') return 'validaya.example.com';
      if (name === 'x-request-id') return 'req-123';
      return null;
    });
    mockResolveInstitution.mockResolvedValue({
      id: 'inst-1',
      slug: 'validaya',
      name: 'Valida YA',
      supportEmail: 'support@validaya.co',
      supportPhone: null,
      dataPolicyUrl: null,
      dataPolicyVersion: '1',
      settings: null,
    });
    mockGetSupabaseUser.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.institution.id).toBe('inst-1');
    expect(ctx.person).toBeNull();
    expect(ctx.capabilities.size).toBe(0);
    expect(ctx.requestId).toBe('req-123');
    expect(ctx.aal).toBeNull();
    expect(ctx.mfaPending).toBe(false);
  });

  it('returns anonymous context when user has no Person in this institution', async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === 'x-tenant-host') return 'validaya.example.com';
      if (name === 'x-request-id') return 'req-456';
      return null;
    });
    mockResolveInstitution.mockResolvedValue({
      id: 'inst-1',
      slug: 'validaya',
      name: 'Valida YA',
      supportEmail: 'support@validaya.co',
      supportPhone: null,
      dataPolicyUrl: null,
      dataPolicyVersion: '1',
      settings: null,
    });
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    mockFindUniquePerson.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.institution.id).toBe('inst-1');
    expect(ctx.person).toBeNull();
    expect(ctx.capabilities.size).toBe(0);
    // User is authenticated but has no Person - aal is still set
    expect(ctx.aal).toBe('aal1');
    expect(ctx.mfaPending).toBe(false);
  });

  it('returns full context with person and capabilities when authenticated', async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === 'x-tenant-host') return 'validaya.example.com';
      if (name === 'x-request-id') return 'req-789';
      return null;
    });
    mockResolveInstitution.mockResolvedValue({
      id: 'inst-1',
      slug: 'validaya',
      name: 'Valida YA',
      supportEmail: 'support@validaya.co',
      supportPhone: null,
      dataPolicyUrl: null,
      dataPolicyVersion: '1',
      settings: null,
    });
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    mockFindUniquePerson.mockResolvedValue({
      id: 'person-1',
      givenName: 'Juan',
      familyName: 'Pérez',
      email: 'juan@example.com',
      authUserId: 'auth-user-1',
      memberships: [
        {
          personId: 'person-1',
          institutionId: 'inst-1',
          role: 'ADMIN',
          revokedAt: null,
        },
      ],
      enrollments: [],
      guardianOf: [],
      partnerContacts: [],
    });
    mockFindUniquePolicy.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.institution.id).toBe('inst-1');
    expect(ctx.person).not.toBeNull();
    expect(ctx.person?.id).toBe('person-1');
    expect(ctx.person?.givenName).toBe('Juan');
    // capabilities is a Map - verify it's populated (resolveCapabilities was called)
    expect(ctx.capabilities).toBeInstanceOf(Map);
    expect(ctx.requestId).toBe('req-789');
    // MFA awareness
    expect(ctx.aal).toBe('aal1');
    expect(ctx.mfaPending).toBe(true); // ADMIN with aal1
  });

  it('feeds deriveAccountStatus the confirmed payments and agreements of each plan', async () => {
    mockGet.mockImplementation((name: string) =>
      name === 'x-tenant-host' ? 'validaya.example.com' : name === 'x-request-id' ? 'req-1' : null
    );
    mockResolveInstitution.mockResolvedValue(institution);
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    const dueOn = new Date('2026-01-15T00:00:00Z');
    mockFindUniquePerson.mockResolvedValue({
      id: 'person-1',
      givenName: 'Ana',
      familyName: 'Ruiz',
      email: 'ana@example.com',
      authUserId: 'auth-user-1',
      memberships: [],
      enrollments: [
        {
          id: 'enr-1',
          studentId: 'person-1',
          cohortId: 'coh-1',
          status: 'ACTIVE',
          isMinorAtEnrollment: false,
          accessUntil: new Date('2027-01-01T00:00:00Z'),
          paymentPlan: {
            payerType: 'PERSON',
            installments: [
              {
                id: 'ins-1',
                position: 1,
                amount: '100000',
                dueOn,
                status: 'PAID',
                agreementId: null,
                payments: [
                  {
                    installmentId: 'ins-1',
                    amount: '100000',
                    confirmedAt: new Date('2026-01-10T00:00:00Z'),
                    voidedAt: null,
                  },
                ],
              },
            ],
          },
          paymentAgreements: [{ id: 'agr-1', enrollmentId: 'enr-1', status: 'FULFILLED' }],
          accommodation: null,
        },
      ],
      guardianOf: [],
      partnerContacts: [],
    });
    mockFindUniquePolicy.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(mockDeriveAccountStatus).toHaveBeenCalledTimes(1);
    const input = mockDeriveAccountStatus.mock.calls[0]![0] as unknown as {
      payerType: string;
      installments: { id: string; amount: number }[];
      payments: { installmentId: string; amount: number }[];
      agreements: { id: string }[];
    };
    expect(input.payerType).toBe('PERSON');
    expect(input.installments).toEqual([expect.objectContaining({ id: 'ins-1', amount: 100000 })]);
    expect(input.payments).toEqual([
      expect.objectContaining({ installmentId: 'ins-1', amount: 100000 }),
    ]);
    expect(input.agreements).toEqual([expect.objectContaining({ id: 'agr-1' })]);
    expect(ctx.accountStatusByEnrollment.get('enr-1')).toBe('CURRENT');
  });

  it('sets mfaPending=true and filters ADMIN/OPERATIONS from capabilities when aal1', async () => {
    mockGet.mockImplementation((name: string) =>
      name === 'x-tenant-host' ? 'validaya.example.com' : name === 'x-request-id' ? 'req-mfa' : null
    );
    mockResolveInstitution.mockResolvedValue(institution);
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
    });
    mockFindUniquePerson.mockResolvedValue({
      id: 'person-1',
      givenName: 'Admin',
      familyName: 'User',
      email: 'admin@example.com',
      authUserId: 'auth-user-1',
      memberships: [
        { personId: 'person-1', institutionId: 'inst-1', role: 'ADMIN', revokedAt: null },
        { personId: 'person-1', institutionId: 'inst-1', role: 'STUDENT', revokedAt: null },
      ],
      enrollments: [],
      guardianOf: [],
      partnerContacts: [],
    });
    mockFindUniquePolicy.mockResolvedValue(null);

    // Import domain mock to capture call
    const { resolveCapabilities } = await import('@colombia-estudia/domain');
    const mockResolve = resolveCapabilities as jest.Mock;

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.aal).toBe('aal1');
    expect(ctx.mfaPending).toBe(true);

    // resolveCapabilities should receive only STUDENT membership (ADMIN filtered out)
    expect(mockResolve).toHaveBeenCalled();
    const capabilitiesInput = mockResolve.mock.calls[0]![0] as { memberships: { role: string }[] };
    const roles = capabilitiesInput.memberships.map((m) => m.role);
    expect(roles).toContain('STUDENT');
    expect(roles).not.toContain('ADMIN');
  });

  it('sets mfaPending=false and includes all memberships when aal2', async () => {
    mockGet.mockImplementation((name: string) =>
      name === 'x-tenant-host'
        ? 'validaya.example.com'
        : name === 'x-request-id'
          ? 'req-aal2'
          : null
    );
    mockResolveInstitution.mockResolvedValue(institution);
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2' },
    });
    mockFindUniquePerson.mockResolvedValue({
      id: 'person-1',
      givenName: 'Admin',
      familyName: 'User',
      email: 'admin@example.com',
      authUserId: 'auth-user-1',
      memberships: [
        { personId: 'person-1', institutionId: 'inst-1', role: 'ADMIN', revokedAt: null },
        { personId: 'person-1', institutionId: 'inst-1', role: 'STUDENT', revokedAt: null },
      ],
      enrollments: [],
      guardianOf: [],
      partnerContacts: [],
    });
    mockFindUniquePolicy.mockResolvedValue(null);

    const { resolveCapabilities } = await import('@colombia-estudia/domain');
    const mockResolve = resolveCapabilities as jest.Mock;
    mockResolve.mockClear();

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.aal).toBe('aal2');
    expect(ctx.mfaPending).toBe(false);

    // resolveCapabilities should receive both memberships
    expect(mockResolve).toHaveBeenCalled();
    const capabilitiesInput = mockResolve.mock.calls[0]![0] as { memberships: { role: string }[] };
    const roles = capabilitiesInput.memberships.map((m) => m.role);
    expect(roles).toContain('STUDENT');
    expect(roles).toContain('ADMIN');
  });

  it('sets mfaPending=false for non-staff roles even at aal1', async () => {
    mockGet.mockImplementation((name: string) =>
      name === 'x-tenant-host'
        ? 'validaya.example.com'
        : name === 'x-request-id'
          ? 'req-student'
          : null
    );
    mockResolveInstitution.mockResolvedValue(institution);
    mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
    mockGetAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1' },
    });
    mockFindUniquePerson.mockResolvedValue({
      id: 'person-1',
      givenName: 'Student',
      familyName: 'User',
      email: 'student@example.com',
      authUserId: 'auth-user-1',
      memberships: [
        { personId: 'person-1', institutionId: 'inst-1', role: 'STUDENT', revokedAt: null },
      ],
      enrollments: [],
      guardianOf: [],
      partnerContacts: [],
    });
    mockFindUniquePolicy.mockResolvedValue(null);

    const { getRequestContext } = await import('@/lib/authz/request-context');
    const ctx = await getRequestContext();

    expect(ctx.aal).toBe('aal1');
    expect(ctx.mfaPending).toBe(false); // No staff membership, so no MFA required
  });
});
