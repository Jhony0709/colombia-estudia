/** @jest-environment node */
/**
 * `registerPerson`: el registro público (Fase B, 23/9).
 * SSOT: features/auth/server/registration.service.ts, docs/plan-redefinicion-2009.md Fase B.1.
 *
 * Lo que importa aquí: que un correo ya conocido no se registre encima; que el menor no
 * firme la política ni se matricule solo; que la matrícula pase por `enrollPerson` y su
 * fallo no tumbe la cuenta; y que si la base falla, el usuario de Auth se borre.
 */

const db = {
  person: { findFirst: jest.fn(), create: jest.fn() },
  institution: { findUniqueOrThrow: jest.fn() },
  membership: { create: jest.fn() },
  consent: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  cohort: { findFirstOrThrow: jest.fn() },
};
const admin = {
  auth: { admin: { createUser: jest.fn(), deleteUser: jest.fn() } },
};
const mockEnrollPerson = jest.fn();
// `institutionSettingsSchema` exige un cuid en `introCohortId` (`lib/institution/settings.ts`):
// con «cohort-intro» a secas el ajuste se descartaba entero y el registro devolvía
// NO_INTRO_COHORT.
const INTRO_COHORT_ID = 'cmuflxkr1000213nqvodk4agt';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    ...db,
    $transaction: (fn: (t: typeof db) => unknown) => fn(db),
  })),
}));
jest.mock('@/lib/auth/supabase-server', () => ({ getSupabaseAdmin: () => admin }));
jest.mock('@/features/cohorts/server/enrollments.service', () => ({
  enrollPerson: (...args: unknown[]) => mockEnrollPerson(...args),
}));

import { registerPerson } from '@/features/auth/server/registration.service';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const BASE = {
  institutionId: 'inst-1',
  givenName: 'Ana',
  familyName: 'Pérez',
  email: 'Ana@Example.com',
  phone: null,
  password: 'una-contraseña-larga',
  acceptsDataPolicy: true,
  now: NOW,
};

beforeEach(() => {
  jest.clearAllMocks();
  db.person.findFirst.mockResolvedValue(null);
  db.institution.findUniqueOrThrow.mockResolvedValue({
    settings: { introCohortId: INTRO_COHORT_ID },
    dataPolicyVersion: '2',
  });
  admin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
  db.person.create.mockResolvedValue({ id: 'p-1' });
  db.cohort.findFirstOrThrow.mockResolvedValue({ code: 'INTRO-1', name: 'Introducción' });
  mockEnrollPerson.mockResolvedValue({ enrollmentId: 'e-1', warning: null });
});

describe('registerPerson', () => {
  it('creates the account, the STUDENT role, the consent and enrols an adult', async () => {
    const result = await registerPerson({ ...BASE, birthDate: '1990-05-01' });

    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com', email_confirm: true })
    );
    expect(db.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'ana@example.com', authUserId: 'auth-1' }),
      })
    );
    expect(db.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'STUDENT' }) })
    );
    expect(db.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ policyVersion: '2' }) })
    );
    expect(mockEnrollPerson).toHaveBeenCalledWith(
      expect.objectContaining({ cohortId: INTRO_COHORT_ID, personHandle: 'ana@example.com' })
    );
    expect(result.enrollment).toEqual({
      status: 'ENROLLED',
      cohortCode: 'INTRO-1',
      cohortName: 'Introducción',
    });
  });

  it('refuses an email already known in the institution', async () => {
    db.person.findFirst.mockResolvedValue({ id: 'p-0', authUserId: null });
    await expect(registerPerson({ ...BASE, birthDate: '1990-05-01' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('requires the data policy from an adult', async () => {
    await expect(
      registerPerson({ ...BASE, birthDate: '1990-05-01', acceptsDataPolicy: false })
    ).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  });

  it('creates a minor without consent and without enrolment', async () => {
    const result = await registerPerson({
      ...BASE,
      birthDate: '2012-05-01',
      acceptsDataPolicy: false,
    });
    expect(result.isMinor).toBe(true);
    expect(db.consent.create).not.toHaveBeenCalled();
    expect(mockEnrollPerson).not.toHaveBeenCalled();
    expect(result.enrollment).toEqual({ status: 'MINOR_NEEDS_GUARDIAN' });
  });

  it('keeps the account when the enrolment fails, and audits why', async () => {
    mockEnrollPerson.mockRejectedValue(
      Object.assign(new Error('La cohorte ya no admite matrículas'), { code: 'CONFLICT' })
    );
    const result = await registerPerson({ ...BASE, birthDate: '1990-05-01' });
    expect(result.personId).toBe('p-1');
    expect(result.enrollment.status).toBe('FAILED');
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'registration_enrollment_failed' }),
      })
    );
  });

  it('says there is no intro cohort when none is configured', async () => {
    db.institution.findUniqueOrThrow.mockResolvedValue({ settings: null, dataPolicyVersion: '1' });
    const result = await registerPerson({ ...BASE, birthDate: '1990-05-01' });
    expect(mockEnrollPerson).not.toHaveBeenCalled();
    expect(result.enrollment).toEqual({ status: 'NO_INTRO_COHORT' });
  });

  it('deletes the Auth user if the database write fails', async () => {
    db.person.create.mockRejectedValue(new Error('boom'));
    await expect(registerPerson({ ...BASE, birthDate: '1990-05-01' })).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('auth-1');
  });
});
