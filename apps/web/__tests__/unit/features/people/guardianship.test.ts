/** @jest-environment node */
/**
 * Tests for guardianships and off-platform consents.
 * SSOT: plan/06-cohortes-y-personas.md:36-37, endpoints.md:75, docs/estado.md §12c
 */

const db = {
  person: { findFirst: jest.fn() },
  guardianship: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  membership: { findFirst: jest.fn(), create: jest.fn() },
  consent: { create: jest.fn() },
  institution: { findUniqueOrThrow: jest.fn() },
  auditLog: { create: jest.fn() },
};

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...db,
    $transaction: (fn: (t: typeof db) => unknown) => fn(db),
  })),
}));

jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));

import {
  linkGuardian,
  unlinkGuardian,
  recordConsent,
} from '@/features/people/server/guardianship.service';

const BASE = { institutionId: 'inst-1', actorId: 'actor-1' };
const NOW = new Date('2026-09-17T12:00:00.000Z');
const MINOR_BIRTH = new Date('2012-05-01T00:00:00.000Z');
const ADULT_BIRTH = new Date('1990-05-01T00:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  db.institution.findUniqueOrThrow.mockResolvedValue({ dataPolicyVersion: '3' });
  db.consent.create.mockResolvedValue({ id: 'consent-1' });
});

describe('linkGuardian', () => {
  const input = {
    ...BASE,
    studentId: 'student-1',
    guardianHandle: '1234567',
    relationship: 'madre',
    isFinancialResponsible: true,
  };

  it('links, grants the GUARDIAN role when missing, and audits both', async () => {
    db.person.findFirst
      .mockResolvedValueOnce({ id: 'guardian-1', givenName: 'Ana', familyName: 'Ruiz' })
      .mockResolvedValueOnce({ id: 'student-1' });
    db.membership.findFirst.mockResolvedValue(null);

    const result = await linkGuardian(input);

    expect(result).toEqual({ guardianId: 'guardian-1' });
    expect(db.membership.create).toHaveBeenCalledWith({
      data: { institutionId: 'inst-1', personId: 'guardian-1', role: 'GUARDIAN' },
    });
    const actions = db.auditLog.create.mock.calls.map((c) => c[0].data.action);
    expect(actions).toEqual(['granted', 'linked']);
  });

  it('does not re-grant the role to someone who already has it', async () => {
    db.person.findFirst
      .mockResolvedValueOnce({ id: 'guardian-1', givenName: 'Ana', familyName: 'Ruiz' })
      .mockResolvedValueOnce({ id: 'student-1' });
    db.membership.findFirst.mockResolvedValue({ id: 'membership-1' });

    await linkGuardian(input);

    expect(db.membership.create).not.toHaveBeenCalled();
    expect(db.auditLog.create.mock.calls.map((c) => c[0].data.action)).toEqual(['linked']);
  });

  it('rejects a handle that matches nobody', async () => {
    db.person.findFirst.mockResolvedValueOnce(null);

    await expect(linkGuardian(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses to make someone their own guardian', async () => {
    db.person.findFirst.mockResolvedValueOnce({
      id: 'student-1',
      givenName: 'A',
      familyName: 'B',
    });

    await expect(linkGuardian(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('turns the duplicate pair into a 409 with a readable message', async () => {
    db.person.findFirst
      .mockResolvedValueOnce({ id: 'guardian-1', givenName: 'Ana', familyName: 'Ruiz' })
      .mockResolvedValueOnce({ id: 'student-1' });
    db.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
    db.guardianship.create.mockRejectedValue({ unique: true });

    await expect(linkGuardian(input)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('unlinkGuardian', () => {
  it('reports when there was nothing to unlink', async () => {
    db.guardianship.findFirst.mockResolvedValue(null);

    const result = await unlinkGuardian({ ...BASE, studentId: 's', guardianId: 'g' });

    expect(result).toEqual({ unlinked: false });
    expect(db.guardianship.delete).not.toHaveBeenCalled();
  });

  it('deletes and audits', async () => {
    db.guardianship.findFirst.mockResolvedValue({ id: 'guardianship-1' });

    await unlinkGuardian({ ...BASE, studentId: 's', guardianId: 'g' });

    expect(db.guardianship.delete).toHaveBeenCalledWith({ where: { id: 'guardianship-1' } });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity: 'guardianship', action: 'unlinked' }),
    });
  });
});

describe('recordConsent', () => {
  it('lets an adult sign for themselves', async () => {
    db.person.findFirst.mockResolvedValueOnce({ id: 'subject-1', birthDate: ADULT_BIRTH });

    await recordConsent({
      ...BASE,
      subjectId: 'subject-1',
      channel: 'PAPER',
      signedByHandle: null,
      now: NOW,
    });

    expect(db.consent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subjectId: 'subject-1',
        signedById: 'subject-1',
        channel: 'PAPER',
        policyVersion: '3',
      }),
      select: { id: true },
    });
  });

  it('refuses a minor signing for themselves', async () => {
    db.person.findFirst.mockResolvedValueOnce({ id: 'subject-1', birthDate: MINOR_BIRTH });

    await expect(
      recordConsent({
        ...BASE,
        subjectId: 'subject-1',
        channel: 'PAPER',
        signedByHandle: null,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.consent.create).not.toHaveBeenCalled();
  });

  it('refuses a signer who is not a registered guardian of the minor', async () => {
    db.person.findFirst
      .mockResolvedValueOnce({ id: 'subject-1', birthDate: MINOR_BIRTH })
      .mockResolvedValueOnce({ id: 'other-1', givenName: 'X', familyName: 'Y' });
    db.guardianship.findFirst.mockResolvedValue(null);

    await expect(
      recordConsent({
        ...BASE,
        subjectId: 'subject-1',
        channel: 'PAPER',
        signedByHandle: '999',
        now: NOW,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.consent.create).not.toHaveBeenCalled();
  });

  it('accepts the minor’s guardian and stamps the institution’s current policy version', async () => {
    db.person.findFirst
      .mockResolvedValueOnce({ id: 'subject-1', birthDate: MINOR_BIRTH })
      .mockResolvedValueOnce({ id: 'guardian-1', givenName: 'Ana', familyName: 'Ruiz' });
    db.guardianship.findFirst.mockResolvedValue({ id: 'guardianship-1' });

    const result = await recordConsent({
      ...BASE,
      subjectId: 'subject-1',
      channel: 'PAPER',
      signedByHandle: '1234567',
      now: NOW,
    });

    expect(result).toEqual({ consentId: 'consent-1' });
    expect(db.consent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signedById: 'guardian-1', policyVersion: '3' }),
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ entity: 'consent', action: 'recorded' }),
    });
  });

  it('treats a person with no birth date as an adult, not as a minor', async () => {
    db.person.findFirst.mockResolvedValueOnce({ id: 'subject-1', birthDate: null });

    await recordConsent({
      ...BASE,
      subjectId: 'subject-1',
      channel: 'EMAIL',
      signedByHandle: null,
      now: NOW,
    });

    expect(db.consent.create).toHaveBeenCalled();
  });
});
