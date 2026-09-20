/** @jest-environment node */
/**
 * `getInvitationOverview`: en qué punto está la invitación de una persona.
 * SSOT: features/auth/server/invitations.service.ts, revisión de UX del 18/9.
 *
 * Es lo que alimenta la sección de invitaciones de la ficha, y no tenía ninguna prueba. Lo que
 * más importa aquí es `mailConfigured`: con `RESEND_API_KEY` vacío el enlace se crea pero
 * **no sale ningún correo**, y una pantalla que diga «invitación enviada» en ese caso hace que
 * alguien espere tres días a que un estudiante entre.
 */

const mockPersonFindFirst = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    person: { findFirst: mockPersonFindFirst },
  })),
}));

import { getInvitationOverview } from '@/features/auth/server/invitations.service';

const NOW = new Date('2026-09-18T12:00:00Z');
const FUTURE = new Date('2026-09-25T12:00:00Z');
const PAST = new Date('2026-09-01T12:00:00Z');

const sentBy = { givenName: 'Ana', familyName: 'Gómez' };

function invitation(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    createdAt: PAST,
    expiresAt: FUTURE,
    acceptedAt: null,
    createdBy: sentBy,
    ...over,
  };
}

const args = { institutionId: 'inst-1', personId: 'person-1', now: NOW };

describe('getInvitationOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_DOMAIN;
  });

  it('devuelve null cuando la persona no existe', async () => {
    mockPersonFindFirst.mockResolvedValue(null);
    await expect(getInvitationOverview(args)).resolves.toBeNull();
  });

  it('sin invitaciones, el estado es "none"', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: null,
      invitations: [],
    });

    const overview = await getInvitationOverview(args);
    expect(overview?.state).toBe('none');
    expect(overview?.history).toHaveLength(0);
  });

  it('una invitación sin aceptar y sin vencer está "pending"', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: null,
      invitations: [invitation()],
    });

    const overview = await getInvitationOverview(args);
    expect(overview?.state).toBe('pending');
    expect(overview?.expiresAt).toBe(FUTURE.toISOString());
  });

  it('una invitación vencida y sin aceptar está "expired", y la marca como muerta', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: null,
      invitations: [invitation({ expiresAt: PAST })],
    });

    const overview = await getInvitationOverview(args);
    expect(overview?.state).toBe('expired');
    expect(overview?.expiresAt).toBeNull();
    expect(overview?.history[0]?.dead).toBe(true);
  });

  it('tener cuenta gana sobre todo lo demás', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: 'auth-1',
      invitations: [invitation()],
    });

    await expect(getInvitationOverview(args)).resolves.toMatchObject({ state: 'account' });
  });

  it('sin correo, lo dice: no se puede invitar a quien no tiene a dónde', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: null,
      authUserId: null,
      invitations: [],
    });

    await expect(getInvitationOverview(args)).resolves.toMatchObject({ hasEmail: false });
  });

  it('mailConfigured es falso sin RESEND_API_KEY: el enlace existe, el correo no sale', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: null,
      invitations: [invitation()],
    });

    await expect(getInvitationOverview(args)).resolves.toMatchObject({ mailConfigured: false });
  });

  it('mailConfigured es cierto solo con la clave Y el dominio', async () => {
    mockPersonFindFirst.mockResolvedValue({
      id: 'person-1',
      email: 'a@b.com',
      authUserId: null,
      invitations: [invitation()],
    });

    process.env.RESEND_API_KEY = 'test-key';
    await expect(getInvitationOverview(args)).resolves.toMatchObject({ mailConfigured: false });

    process.env.EMAIL_DOMAIN = 'colombiaestudia.co';
    await expect(getInvitationOverview(args)).resolves.toMatchObject({ mailConfigured: true });
  });
});
