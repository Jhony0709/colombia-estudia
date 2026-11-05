/** @jest-environment node */
/**
 * Lo que llega por WhatsApp (5/11): todo queda en la conversación; el bot saluda o responde, y
 * «Hablar con un asesor» la deja esperando y avisa a quienes atienden. SSOT:
 * features/messaging/server/inbound.service.ts.
 */

const prisma = {
  institution: { findUnique: jest.fn() },
  conversation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  conversationMessage: { create: jest.fn() },
};
const tenantDb = { person: { findMany: jest.fn() } };
const mockSendText = jest.fn();
const mockSendList = jest.fn();
const mockSendTemplate = jest.fn();
const mockNotifyMany = jest.fn();
const mockAttemptCode = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
  createTenantClient: jest.fn(() => tenantDb),
}));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/seo/site-url', () => ({ siteUrl: () => 'https://alba.test' }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  sendText: (...args: unknown[]) => mockSendText(...args),
  sendList: (...args: unknown[]) => mockSendList(...args),
  sendTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  staffPersonIds: jest.fn(async () => ['staff-1', 'staff-2']),
}));
jest.mock('@/features/requests/server/whatsapp.service', () => ({
  handleInboundMessage: (...args: unknown[]) => mockAttemptCode(...args),
}));
jest.mock('@/features/requests/server/requests.service', () => ({
  whatsappIdOf: (phone: string | null) => (phone ? `57${phone.replace(/\D/g, '')}` : null),
}));

import { handleWhatsAppMessage } from '@/features/messaging/server/inbound.service';

const AT = new Date('2026-11-05T15:00:00.000Z');
const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'wamid.1',
  from: '573001112233',
  name: 'Laura',
  phoneNumberId: 'pn-1',
  text: 'Buenas tardes',
  choiceId: null,
  at: AT,
  ...overrides,
});
const conversation = (status: string, assignedToId: string | null = null) => ({
  id: 'conv-1',
  institutionId: 'inst-1',
  status,
  contact: '573001112233',
  contactName: 'Laura',
  assignedToId,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.institution.findUnique.mockResolvedValue({
    id: 'inst-1',
    name: 'ALBA Futuro Educativo',
    whatsappAgentPhones: ['573102502207', '33652614789'],
  });
  prisma.conversation.findUnique.mockResolvedValue({ id: 'conv-1' });
  prisma.conversation.update.mockResolvedValue(conversation('BOT'));
  prisma.conversationMessage.create.mockResolvedValue({ id: 'm-1' });
  tenantDb.person.findMany.mockResolvedValue([]);
  mockAttemptCode.mockResolvedValue('no_code');
  mockSendText.mockResolvedValue({ sent: true, id: 'wamid.out' });
  mockSendList.mockResolvedValue({ sent: true, id: 'wamid.menu' });
  mockSendTemplate.mockResolvedValue({ sent: true, id: 'wamid.tpl' });
  delete process.env.WHATSAPP_TEMPLATE_NEW_CHAT;
});

describe('handleWhatsAppMessage', () => {
  it('un mensaje cualquiera queda guardado y el bot saluda con el menú', async () => {
    expect(await handleWhatsAppMessage(message())).toBe('menu');

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv-1',
        direction: 'INBOUND',
        body: 'Buenas tardes',
        externalId: 'wamid.1',
      }),
    });
    expect(mockSendList).toHaveBeenCalledWith(
      '573001112233',
      expect.objectContaining({ button: 'Ver opciones' }),
      'pn-1'
    );
    // Lo que dice el bot también queda en el hilo.
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: 'OUTBOUND', fromBot: true }),
    });
  });

  it('una opción del menú se responde con su texto', async () => {
    expect(await handleWhatsAppMessage(message({ choiceId: 'programas' }))).toBe('answered');
    expect(mockSendText).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('https://alba.test/#programas'),
      'pn-1'
    );
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('«Hablar con un asesor» la deja esperando y avisa a quienes atienden', async () => {
    process.env.WHATSAPP_TEMPLATE_NEW_CHAT = 'nuevo_chat';

    expect(await handleWhatsAppMessage(message({ choiceId: 'asesor' }))).toBe('waiting');

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { status: 'WAITING', waitingSince: AT, assignedToId: null, assignedAt: null },
    });
    expect(mockSendTemplate).toHaveBeenCalledTimes(2);
    expect(mockSendTemplate).toHaveBeenCalledWith(
      '573102502207',
      'nuevo_chat',
      ['Laura', '+573001112233'],
      { phoneNumberId: 'pn-1', urlSuffix: 'conv-1' }
    );
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['staff-1', 'staff-2'],
      expect.objectContaining({ type: 'conversation_waiting', href: '/mensajes/conv-1' })
    );
  });

  it('esperando asesor, lo que escribe se guarda y nadie contesta', async () => {
    prisma.conversation.update.mockResolvedValueOnce(conversation('WAITING'));
    expect(await handleWhatsAppMessage(message())).toBe('stored');
    expect(mockSendText).not.toHaveBeenCalled();
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('en curso, se guarda y se avisa a quien lo atiende', async () => {
    prisma.conversation.update.mockResolvedValueOnce(conversation('OPEN', 'staff-2'));
    expect(await handleWhatsAppMessage(message())).toBe('stored');
    expect(mockSendList).not.toHaveBeenCalled();
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['staff-2'],
      expect.objectContaining({ type: 'conversation_message' })
    );
  });

  it('cerrada que vuelve a escribir: la atiende el bot otra vez', async () => {
    prisma.conversation.update.mockResolvedValueOnce(conversation('CLOSED', 'staff-2'));
    expect(await handleWhatsAppMessage(message())).toBe('menu');
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { status: 'BOT', assignedToId: null, assignedAt: null },
    });
  });

  it('lo que Meta reintenta no se contesta dos veces', async () => {
    prisma.conversationMessage.create.mockRejectedValueOnce({ unique: true });
    expect(await handleWhatsAppMessage(message())).toBe('duplicate');
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('el código de una solicitud de otra oportunidad no recibe el menú', async () => {
    mockAttemptCode.mockResolvedValue('linked');
    expect(await handleWhatsAppMessage(message())).toBe('attempt_request');
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('un número que no es de ninguna institución solo puede enlazar un código', async () => {
    prisma.institution.findUnique.mockResolvedValue(null);
    expect(await handleWhatsAppMessage(message())).toBe('unknown_number');
    expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
    expect(mockAttemptCode).toHaveBeenCalled();
  });

  it('alguien nuevo: se busca a la persona por su número y se crea la conversación', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(conversation('BOT'));
    tenantDb.person.findMany.mockResolvedValue([{ id: 'p-9', phone: '300 111 2233' }]);

    expect(await handleWhatsAppMessage(message())).toBe('menu');
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: 'p-9' }) })
    );
  });

  it('dos mensajes seguidos de alguien nuevo: el segundo usa la que creó el primero', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockRejectedValue({ unique: true });

    expect(await handleWhatsAppMessage(message())).toBe('menu');
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastInboundAt: AT }) })
    );
  });
});
