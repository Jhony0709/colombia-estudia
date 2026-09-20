/** @jest-environment node */
/**
 * El lote de invitaciones.
 * SSOT: plan/06-cohortes-y-personas.md:57-63 — "lotes de 20 con Promise.allSettled y
 * registro de fallos; sin colas".
 */

const mockCohortFindFirst = jest.fn();
const mockEnrollmentFindMany = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockSendInvitation = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    cohort: { findFirst: mockCohortFindFirst },
    enrollment: { findMany: mockEnrollmentFindMany },
    auditLog: { create: mockAuditLogCreate },
  })),
}));

jest.mock('@/features/auth/server/invitations.service', () => ({
  sendInvitation: (...args: unknown[]) => mockSendInvitation(...args),
}));

import {
  planBulkInvitations,
  sendBulkInvitations,
  chunk,
  BATCH_SIZE,
} from '@/features/cohorts/server/bulk-invitations.service';

const INSTITUTION = {
  id: 'inst1',
  name: 'Colombia Estudia',
  emailFromName: 'Colombia Estudia',
  supportEmail: 'soporte@example.com',
};

const student = (
  id: string,
  over: { email?: string | null; authUserId?: string | null; pending?: boolean } = {}
) => ({
  student: {
    id,
    givenName: id,
    familyName: 'Apellido',
    email: over.email === undefined ? `${id}@example.com` : over.email,
    authUserId: over.authUserId ?? null,
    invitations: over.pending ? [{ id: 'inv' }] : [],
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCohortFindFirst.mockResolvedValue({ id: 'c1' });
  mockSendInvitation.mockResolvedValue({ invitationId: 'inv' });
});

describe('chunk', () => {
  it('parte en trozos del tamaño pedido sin perder elementos', () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const batches = chunk(items, BATCH_SIZE);

    expect(batches.map((b) => b.length)).toEqual([20, 20, 5]);
    expect(batches.flat()).toEqual(items);
  });

  it('una lista vacía no produce ningún lote', () => {
    expect(chunk([], BATCH_SIZE)).toEqual([]);
  });
});

describe('planBulkInvitations', () => {
  it('separa a quien puede recibirla de quien no, con el motivo', async () => {
    mockEnrollmentFindMany.mockResolvedValue([
      student('ana'),
      student('beto', { email: null }),
      student('caro', { authUserId: 'auth1' }),
      student('dani', { pending: true }),
    ]);

    const plan = await planBulkInvitations({ institutionId: 'inst1', cohortId: 'c1' });

    expect(plan.sendable).toBe(1);
    expect(plan.candidates.map((c) => c.skip)).toEqual([
      null,
      'no-email',
      'has-account',
      'pending-invitation',
    ]);
  });
});

describe('sendBulkInvitations', () => {
  it('un correo que falla no impide los demás, y queda registrado con su motivo', async () => {
    mockEnrollmentFindMany.mockResolvedValue([student('ana'), student('beto'), student('caro')]);
    mockSendInvitation
      .mockResolvedValueOnce({ invitationId: 'i1' })
      .mockRejectedValueOnce(new Error('Resend rechazó el correo'))
      .mockResolvedValueOnce({ invitationId: 'i3' });

    const result = await sendBulkInvitations({
      institution: INSTITUTION,
      cohortId: 'c1',
      actorId: 'actor1',
      origin: 'https://ejemplo.test',
    });

    expect(result.sent).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.name).toBe('Apellido, beto');
    expect(result.failed[0]?.reason).toBe('Resend rechazó el correo');
  });

  it('no invita a quien ya tiene cuenta, correo ausente o invitación vigente', async () => {
    mockEnrollmentFindMany.mockResolvedValue([
      student('ana'),
      student('beto', { email: null }),
      student('caro', { authUserId: 'auth1' }),
    ]);

    const result = await sendBulkInvitations({
      institution: INSTITUTION,
      cohortId: 'c1',
      actorId: 'actor1',
      origin: 'https://ejemplo.test',
    });

    expect(mockSendInvitation).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it('envía en lotes de 20, no todos a la vez', async () => {
    mockEnrollmentFindMany.mockResolvedValue(
      Array.from({ length: 45 }, (_, i) => student(`p${i}`))
    );

    let enVuelo = 0;
    let maximoEnVuelo = 0;
    mockSendInvitation.mockImplementation(async () => {
      enVuelo += 1;
      maximoEnVuelo = Math.max(maximoEnVuelo, enVuelo);
      await new Promise((resolve) => setTimeout(resolve, 0));
      enVuelo -= 1;
      return { invitationId: 'i' };
    });

    const result = await sendBulkInvitations({
      institution: INSTITUTION,
      cohortId: 'c1',
      actorId: 'actor1',
      origin: 'https://ejemplo.test',
    });

    expect(result.sent).toBe(45);
    expect(maximoEnVuelo).toBeLessThanOrEqual(BATCH_SIZE);
  });

  it('audita el envío con el resumen', async () => {
    mockEnrollmentFindMany.mockResolvedValue([student('ana'), student('beto', { email: null })]);

    await sendBulkInvitations({
      institution: INSTITUTION,
      cohortId: 'c1',
      actorId: 'actor1',
      origin: 'https://ejemplo.test',
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entity: 'invitation',
        action: 'bulk_sent',
        actorId: 'actor1',
        after: { cohortId: 'c1', sent: 1, failed: 0, skipped: 1 },
      }),
    });
  });

  it('se niega si no hay nadie a quien invitar', async () => {
    mockEnrollmentFindMany.mockResolvedValue([student('beto', { email: null })]);

    await expect(
      sendBulkInvitations({
        institution: INSTITUTION,
        cohortId: 'c1',
        actorId: 'actor1',
        origin: 'https://ejemplo.test',
      })
    ).rejects.toThrow('Nadie de esta cohorte');

    expect(mockSendInvitation).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});
