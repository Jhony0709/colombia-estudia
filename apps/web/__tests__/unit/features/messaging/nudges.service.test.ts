/** @jest-environment node */
/**
 * Retomar lo que quedó a medias (22/11): un recordatorio por formulario y uno por correo sin
 * confirmar, siempre dentro de las 24 h. SSOT: features/messaging/server/nudges.service.ts.
 */

const prisma = {
  conversation: { findMany: jest.fn(), update: jest.fn() },
  conversationMessage: { create: jest.fn() },
};
const mockSendButtons = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  SERVICE_WINDOW_MS: 24 * 60 * 60 * 1000,
  sendButtons: (...args: unknown[]) => mockSendButtons(...args),
}));

import { intakeNudgeText, runChatNudges } from '@/features/messaging/server/nudges.service';

const NOW = new Date('2026-11-23T15:00:00.000Z');
const base = {
  id: 'conv-1',
  institutionId: 'inst-1',
  contact: '573001112233',
  institution: { whatsappPhoneNumberId: 'pn-1' },
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.conversation.findMany.mockResolvedValue([]);
  mockSendButtons.mockResolvedValue({ sent: true, id: 'wamid.n' });
});

it('el texto: su nombre y cuántos datos le faltan', () => {
  expect(intakeNudgeText('ENROLL', 6, { fullName: 'Laura Gómez', adult: 'Sí, 18 o más' })).toBe(
    '¿Seguimos, Laura? 🙌 Para tu inscripción te falta 1 dato.'
  );
  expect(intakeNudgeText('ACCOUNT', 0, {})).toContain('crear tu cuenta te faltan 4 datos');
  expect(intakeNudgeText('ENROLL', 7, { fullName: 'Ana' })).toContain('solo te falta confirmar');
});

it('formulario a medias: un recordatorio con «Continuar» y «Cancelar», y se marca', async () => {
  prisma.conversation.findMany.mockResolvedValueOnce([
    { ...base, intakeKind: 'ENROLL', intakeStep: 6, intake: { fullName: 'Laura' } },
    { ...base, id: 'conv-2', intakeKind: 'ENROLL', intakeStep: 2, intake: { _nudgedAt: 'x' } },
  ]);
  expect(await runChatNudges(NOW)).toEqual({ intake: 1, email: 0, failed: 0 });
  expect(mockSendButtons).toHaveBeenCalledWith(
    '573001112233',
    expect.stringContaining('¿Seguimos, Laura?'),
    [
      { id: 'intake_continue', title: 'Continuar' },
      { id: 'intake_cancel', title: 'Cancelar' },
    ],
    'pn-1'
  );
  expect(prisma.conversation.update).toHaveBeenCalledWith({
    where: { id: 'conv-1' },
    data: { intake: { fullName: 'Laura', _nudgedAt: NOW.toISOString() }, lastMessageAt: NOW },
  });
  // Solo lo que lleva hora y media quieto y sigue dentro de la ventana.
  const where = prisma.conversation.findMany.mock.calls[0][0].where;
  expect(where.lastInboundAt.lte).toEqual(new Date(NOW.getTime() - 90 * 60_000));
  expect(where.lastInboundAt.gte).toEqual(new Date(NOW.getTime() - 23 * 60 * 60_000));
});

it('cuenta sin confirmar el correo: a las 2 horas, «Reenviar correo», una sola vez', async () => {
  const at = (h: number) => new Date(NOW.getTime() - h * 60 * 60_000).toISOString();
  prisma.conversation.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
    { ...base, intake: { _accountAt: at(3) } },
    { ...base, id: 'conv-2', intake: { _accountAt: at(1) } },
    { ...base, id: 'conv-3', intake: { _accountAt: at(5), _emailNudgedAt: at(1) } },
  ]);
  expect(await runChatNudges(NOW)).toEqual({ intake: 0, email: 1, failed: 0 });
  expect(mockSendButtons).toHaveBeenCalledWith(
    '573001112233',
    expect.stringContaining('confirmar tu correo'),
    expect.arrayContaining([{ id: 'cuenta_reenviar', title: 'Reenviar correo' }]),
    'pn-1'
  );
  expect(prisma.conversation.findMany.mock.calls[1][0].where).toMatchObject({
    intakeKind: 'ACCOUNT',
    intakeStep: null,
    person: { authUserId: null },
  });
});
