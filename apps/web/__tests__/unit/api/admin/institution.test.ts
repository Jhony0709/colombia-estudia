/** @jest-environment node */
/**
 * Tests for PUT /api/admin/institution and the service behind it.
 * SSOT: plan/06-cohortes-y-personas.md:11-18 (§1 Institución), docs/estado.md §11a
 */

import { NextRequest } from 'next/server';

const mockUpdateInstitution = jest.fn();
const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: jest.fn(),
}));

jest.mock('@/features/admin/server/institution.service', () => ({
  updateInstitution: (...args: unknown[]) => mockUpdateInstitution(...args),
}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    institution: { findUniqueOrThrow: mockFindUniqueOrThrow, update: mockUpdate },
    auditLog: { create: mockAuditLogCreate },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        institution: { findUniqueOrThrow: mockFindUniqueOrThrow, update: mockUpdate },
        auditLog: { create: mockAuditLogCreate },
      }),
  })),
}));

import { getRequestContext } from '@/lib/authz/request-context';

const VALID = {
  name: 'Colombia Estudia',
  legalName: 'Colombia Estudia SAS',
  taxId: '900123456-1',
  brandColor: '#1D4ED8',
  supportEmail: 'soporte@colombiaestudia.co',
  supportPhone: '3001234567',
  emailFromName: 'Colombia Estudia',
  dataPolicyUrl: 'https://colombiaestudia.co/politica',
  dataPolicyVersion: '1',
};

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/institution', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

function contextWith(capabilities: string[]) {
  return {
    institution: { id: 'inst-1', name: 'Colombia Estudia' },
    person: { id: 'person-1' },
    capabilities: new Map(capabilities.map((c) => [c, [{ institution: true }]])),
  };
}

describe('PUT /api/admin/institution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRequestContext as jest.Mock).mockResolvedValue(contextWith(['institution.manage']));
    mockUpdateInstitution.mockResolvedValue({ settings: { id: 'inst-1', ...VALID }, changed: [] });
  });

  it('rejects a caller without institution.manage', async () => {
    (getRequestContext as jest.Mock).mockResolvedValue(contextWith(['lesson.read']));
    const { PUT } = await import('@/app/api/admin/institution/route');

    const response = await PUT(request(VALID));

    expect(response.status).toBe(403);
    expect(mockUpdateInstitution).not.toHaveBeenCalled();
  });

  it('rejects an empty name with a field error', async () => {
    const { PUT } = await import('@/app/api/admin/institution/route');

    const response = await PUT(request({ ...VALID, name: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.name).toBeDefined();
    expect(mockUpdateInstitution).not.toHaveBeenCalled();
  });

  it('rejects a brand colour that is not #RRGGBB', async () => {
    const { PUT } = await import('@/app/api/admin/institution/route');

    const response = await PUT(request({ ...VALID, brandColor: 'azul' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details.brandColor).toBeDefined();
  });

  it('accepts an empty brand colour and stores it as null', async () => {
    const { PUT } = await import('@/app/api/admin/institution/route');

    const response = await PUT(request({ ...VALID, brandColor: '', supportPhone: '' }));

    expect(response.status).toBe(200);
    expect(mockUpdateInstitution).toHaveBeenCalledWith(
      expect.objectContaining({
        institutionId: 'inst-1',
        actorId: 'person-1',
        data: expect.objectContaining({ brandColor: null, supportPhone: null }),
      })
    );
  });

  it('rejects an invalid data policy URL', async () => {
    const { PUT } = await import('@/app/api/admin/institution/route');

    const response = await PUT(request({ ...VALID, dataPolicyUrl: 'no-es-una-url' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details.dataPolicyUrl).toBeDefined();
  });
});
