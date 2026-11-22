/** @jest-environment node */
/**
 * Crear la cuenta desde WhatsApp (22/11): ficha, rol de estudiante, introducción e invitación
 * «confirma tu correo». SSOT: features/messaging/server/chat-account.service.ts.
 */

const tx = {
  person: { create: jest.fn() },
  membership: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  person: { findFirst: jest.fn() },
  institution: { findUniqueOrThrow: jest.fn() },
  $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const prisma = { conversation: { update: jest.fn() } };
const mockInvite = jest.fn();
const mockEnroll = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
  createTenantClient: () => db,
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/seo/site-url', () => ({ siteUrl: () => 'https://alba.test' }));
jest.mock('@/features/auth/server/invitations.service', () => ({
  sendInvitation: (...args: unknown[]) => mockInvite(...args),
}));
jest.mock('@/features/auth/server/registration.service', () => ({
  enrollInIntroCohort: (...args: unknown[]) => mockEnroll(...args),
}));

import { createAccountFromChat } from '@/features/messaging/server/chat-account.service';

const NOW = new Date('2026-11-22T15:00:00.000Z');
const DATA = {
  adult: 'Sí, 18 o más',
  fullName: 'Laura Gómez Ruiz',
  email: ' Laura@Correo.co ',
  birthDate: '1990-12-31',
  phone: '+573001112233',
  _consentAt: '2026-11-22T14:59:00.000Z',
};
const BASE = { institutionId: 'inst-1', conversationId: 'conv-1', data: DATA, now: NOW };
const INSTITUTION = {
  id: 'inst-1',
  name: 'ALBA',
  emailFromName: 'ALBA',
  supportEmail: 'info@alba.test',
  introCohortId: 'intro-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  db.person.findFirst.mockResolvedValue(null);
  db.institution.findUniqueOrThrow.mockResolvedValue(INSTITUTION);
  tx.person.create.mockResolvedValue({ id: 'p-1' });
  mockEnroll.mockResolvedValue({ status: 'ENROLLED' });
  mockInvite.mockResolvedValue({ emailDelivered: true });
});

it('crea la ficha de estudiante, la enlaza al chat, la matricula y envía «confirma tu correo»', async () => {
  expect(await createAccountFromChat(BASE)).toEqual({
    status: 'sent',
    email: 'laura@correo.co',
    enrolled: true,
  });
  expect(tx.person.create).toHaveBeenCalledWith({
    data: {
      institutionId: 'inst-1',
      givenName: 'Laura',
      familyName: 'Gómez Ruiz',
      email: 'laura@correo.co',
      phone: '+573001112233',
      birthDate: new Date('1990-12-31T00:00:00.000Z'),
    },
    select: { id: true },
  });
  expect(tx.membership.create).toHaveBeenCalledWith({
    data: { institutionId: 'inst-1', personId: 'p-1', role: 'STUDENT' },
  });
  expect(prisma.conversation.update).toHaveBeenCalledWith({
    where: { id: 'conv-1' },
    data: { personId: 'p-1' },
  });
  expect(mockEnroll).toHaveBeenCalledWith(
    expect.objectContaining({ personId: 'p-1', introCohortId: 'intro-1' })
  );
  expect(mockInvite).toHaveBeenCalledWith(
    expect.objectContaining({ personId: 'p-1', actorId: 'p-1', confirm: true })
  );
});

it('un correo que ya existe no se registra otra vez', async () => {
  db.person.findFirst.mockResolvedValueOnce({ authUserId: 'u-1' });
  expect(await createAccountFromChat(BASE)).toEqual({ status: 'has_account' });
  db.person.findFirst.mockResolvedValueOnce({ authUserId: null });
  expect(await createAccountFromChat(BASE)).toEqual({ status: 'has_profile' });
  expect(tx.person.create).not.toHaveBeenCalled();
  expect(mockInvite).not.toHaveBeenCalled();
});

it('sin apellido o sin fecha no crea nada', async () => {
  expect(await createAccountFromChat({ ...BASE, data: { ...DATA, fullName: 'Laura' } })).toEqual({
    status: 'failed',
  });
  expect(tx.person.create).not.toHaveBeenCalled();
});

it('si el correo no sale (sin proveedor), no dice que lo envió', async () => {
  mockInvite.mockResolvedValueOnce({ emailDelivered: false });
  expect(await createAccountFromChat(BASE)).toEqual({ status: 'not_delivered' });
});
