/** @jest-environment node */
/**
 * Tests for GET /api/invitations/[token] endpoint.
 * SSOT: docs/estado.md §9c
 */

import { NextRequest } from 'next/server';

// Mock server-only
jest.mock('server-only', () => ({}));

// Mock validate token
const mockValidateInvitationToken = jest.fn();
jest.mock('@/lib/invitations/validate-token', () => ({
  validateInvitationToken: (...args: unknown[]) => mockValidateInvitationToken(...args),
}));

// Import after mocks
import { GET } from '@/app/api/invitations/[token]/route';

describe('GET /api/invitations/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(token: string) {
    return new NextRequest(new URL(`/api/invitations/${token}`, 'http://localhost'));
  }

  async function callEndpoint(token: string) {
    return GET(createRequest(token), { params: Promise.resolve({ token }) });
  }

  it('returns 404 when invitation not found', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'not_found' });

    const response = await callEndpoint('invalid-token');
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 410 when invitation expired', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'expired' });

    const response = await callEndpoint('expired-token');
    expect(response.status).toBe(410);

    const body = await response.json();
    expect(body.error.code).toBe('ACCESS_EXPIRED');
  });

  it('returns 410 when invitation already used', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'used' });

    const response = await callEndpoint('used-token');
    expect(response.status).toBe(410);

    const body = await response.json();
    expect(body.error.code).toBe('ACCESS_EXPIRED');
  });

  it('returns 409 when person already registered', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'already_registered' });

    const response = await callEndpoint('registered-token');
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns only givenName, isMinor, institutionName, dataPolicyUrl for valid invitation', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test Institution',
      dataPolicyUrl: 'https://example.com/policy',
      // These internal fields should NOT be returned
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });

    const response = await callEndpoint('valid-token');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual({
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test Institution',
      dataPolicyUrl: 'https://example.com/policy',
    });

    // Ensure internal fields are NOT exposed
    expect(body.data.invitationId).toBeUndefined();
    expect(body.data.institutionId).toBeUndefined();
    expect(body.data.personId).toBeUndefined();
    expect(body.data.dataPolicyVersion).toBeUndefined();
  });

  it('returns isMinor true for minor invitation', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'María',
      isMinor: true,
      institutionName: 'Test Institution',
      dataPolicyUrl: null,
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });

    const response = await callEndpoint('minor-token');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.isMinor).toBe(true);
    expect(body.data.dataPolicyUrl).toBeNull();
  });
});
