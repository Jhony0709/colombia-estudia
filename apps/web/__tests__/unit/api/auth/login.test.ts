/** @jest-environment node */
/**
 * Tests for POST /api/auth/login endpoint.
 * SSOT: docs/estado.md §9b corrections
 */

import { NextRequest } from 'next/server';

// Mock functions - use jest.fn() directly in the mock factories

// Mock Supabase
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  })),
}));

// Mock the request-context module to avoid ESM dependencies
jest.mock('@/lib/authz/request-context', () => ({
  MFA_REQUIRED_ROLES: ['ADMIN', 'OPERATIONS'],
}));

// Mock institution cache
jest.mock('@/lib/authz/institution-cache', () => ({
  resolveInstitutionBySlug: jest.fn(),
}));

// Mock tenant client
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    person: { findUnique: jest.fn() },
  })),
}));

// Import mocks to configure them
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { resolveInstitutionBySlug } from '@/lib/authz/institution-cache';
import { createTenantClient } from '@/lib/db/tenant';

// Import handler after mocks
import { POST } from '@/app/api/auth/login/route';

const institution = {
  id: 'inst-1',
  slug: 'colombia-estudia',
  name: 'Colombia Estudia',
  supportEmail: 'support@colombiaestudia.co',
  supportPhone: null,
  dataPolicyVersion: '1',
  settings: null,
};

describe('POST /api/auth/login', () => {
  // Reference to mock functions
  let mockSupabaseAuth: {
    signInWithPassword: jest.Mock;
    signOut: jest.Mock;
  };
  let mockPersonFindUnique: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockSupabaseAuth = {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    };
    (createServerSupabaseClient as jest.Mock).mockResolvedValue({
      auth: mockSupabaseAuth,
    });

    (resolveInstitutionBySlug as jest.Mock).mockResolvedValue(institution);

    mockPersonFindUnique = jest.fn();
    (createTenantClient as jest.Mock).mockReturnValue({
      person: { findUnique: mockPersonFindUnique },
    });
  });

  function createRequest(body: object) {
    return new NextRequest(new URL('/api/auth/login', 'http://localhost:3000'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 200 with { data: { next: "/" } } on successful login', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'STUDENT', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'student@example.com',
        password: 'validpassword123',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toBe('/');
  });

  it('preserves next parameter on successful login', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'STUDENT', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'student@example.com',
        password: 'validpassword123',
        next: '/aprender',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toBe('/aprender');
  });

  it('sanitizes malicious next parameter to /', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'STUDENT', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'student@example.com',
        password: 'validpassword123',
        next: '//evil.com',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toBe('/');
  });

  it('returns 401 with generic message on bad credentials', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const response = await POST(
      createRequest({
        email: 'user@example.com',
        password: 'wrongpassword',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toBe('Correo o contraseña incorrectos');
  });

  it('returns 401 with same message for non-existent email', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    const response = await POST(
      createRequest({
        email: 'nonexistent@example.com',
        password: 'anypassword',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toBe('Correo o contraseña incorrectos');
  });

  it('calls signOut and returns 401 when user has no Person in institution', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue(null);

    const response = await POST(
      createRequest({
        email: 'orphan@example.com',
        password: 'validpassword',
      })
    );

    expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toBe('Correo o contraseña incorrectos');
  });

  it('redirects ADMIN to /auth/mfa preserving original next', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'ADMIN', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'admin@example.com',
        password: 'validpassword123',
        next: '/admin/institucion',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toMatch(/^\/auth\/mfa/);
    expect(body.data.next).toContain('next=');
    expect(body.data.next).toContain(encodeURIComponent('/admin/institucion'));
  });

  it('redirects OPERATIONS to /auth/mfa', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'OPERATIONS', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'ops@example.com',
        password: 'validpassword123',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).toMatch(/^\/auth\/mfa/);
  });

  it('STUDENT never redirects to /auth/mfa', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'STUDENT', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'student@example.com',
        password: 'validpassword123',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).not.toContain('/auth/mfa');
  });

  it('INSTRUCTOR never redirects to /auth/mfa', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockPersonFindUnique.mockResolvedValue({
      memberships: [{ role: 'INSTRUCTOR', revokedAt: null }],
    });

    const response = await POST(
      createRequest({
        email: 'instructor@example.com',
        password: 'validpassword123',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.next).not.toContain('/auth/mfa');
  });
});
