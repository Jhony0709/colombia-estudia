/** @jest-environment node */
/**
 * Tests for the institution service (the real one: no mock of itself here).
 * SSOT: plan/06-cohortes-y-personas.md:17 (AuditLog institution.updated), docs/estado.md §11a
 */

const mockFindUniqueOrThrow = jest.fn();
const mockUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => {
    const tx = {
      institution: { findUniqueOrThrow: mockFindUniqueOrThrow, update: mockUpdate },
      auditLog: { create: mockAuditLogCreate },
    };
    return { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  }),
}));

import { updateInstitution, diffSettings } from '@/features/admin/server/institution.service';

const STORED = {
  id: 'inst-1',
  name: 'Colombia Estudia',
  legalName: null,
  taxId: null,
  brandColor: null,
  supportEmail: 'soporte@colombiaestudia.co',
  supportPhone: null,
  emailFromName: 'Colombia Estudia',
  dataPolicyUrl: null,
  dataPolicyVersion: '1',
};

const { id: _id, ...CURRENT } = STORED;

describe('diffSettings', () => {
  it('lists only the keys whose value changed', () => {
    expect(diffSettings(CURRENT, { ...CURRENT, taxId: '900123456-1' })).toEqual(['taxId']);
  });

  it('returns an empty list for identical input', () => {
    expect(diffSettings(CURRENT, { ...CURRENT })).toEqual([]);
  });

  it('treats null and empty string as different values', () => {
    expect(diffSettings(CURRENT, { ...CURRENT, legalName: '' })).toEqual(['legalName']);
  });
});

describe('updateInstitution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUniqueOrThrow.mockResolvedValue(STORED);
  });

  it('audits only the fields that changed, with before and after', async () => {
    const next = { ...CURRENT, dataPolicyVersion: '2', supportPhone: '3001234567' };
    mockUpdate.mockResolvedValue({ ...STORED, ...next });

    const result = await updateInstitution({
      institutionId: 'inst-1',
      actorId: 'person-1',
      data: next,
    });

    expect([...result.changed].sort()).toEqual(['dataPolicyVersion', 'supportPhone']);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        institutionId: 'inst-1',
        actorId: 'person-1',
        entity: 'institution',
        entityId: 'inst-1',
        action: 'updated',
        before: { dataPolicyVersion: '1', supportPhone: null },
        after: { dataPolicyVersion: '2', supportPhone: '3001234567' },
      },
    });
  });

  it('writes nothing when the payload matches what is stored', async () => {
    const result = await updateInstitution({
      institutionId: 'inst-1',
      actorId: 'person-1',
      data: CURRENT,
    });

    expect(result.changed).toEqual([]);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('keeps a null actor when the change has no identified person', async () => {
    mockUpdate.mockResolvedValue({ ...STORED, name: 'Otro nombre' });

    await updateInstitution({
      institutionId: 'inst-1',
      actorId: null,
      data: { ...CURRENT, name: 'Otro nombre' },
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: null }),
    });
  });
});
