/** @jest-environment node */
/**
 * La bandeja (5/11): el primero que toma el chat lo atiende; solo esa persona responde y cierra,
 * y en WhatsApp solo dentro de las 24 h. SSOT: features/messaging/server/conversations.service.ts.
 */

const prisma = {
  conversation: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  conversationMessage: { create: jest.fn() },
  institution: { findUnique: jest.fn() },
  person: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};
const mockSendText = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
}));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  SERVICE_WINDOW_MS: 24 * 60 * 60 * 1000,
  sendText: (...args: unknown[]) => mockSendText(...args),
}));

import {
  closeConversation,
  replyToConversation,
  takeConversation,
} from '@/features/messaging/server/conversations.service';

const NOW = new Date('2026-11-05T15:00:00.000Z');
const BASE = { institutionId: 'inst-1', actorId: 'staff-1', conversationId: 'conv-1', now: NOW };
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  contact: '573001112233',
  status: 'WAITING',
  assignedToId: null,
  lastInboundAt: new Date(NOW.getTime() - 5 * 60_000),
  assignedTo: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.conversation.findFirst.mockResolvedValue(row());
  prisma.conversation.updateMany.mockResolvedValue({ count: 1 });
  prisma.institution.findUnique.mockResolvedValue({ whatsappPhoneNumberId: 'pn-1' });
  prisma.person.findFirst.mockResolvedValue({ givenName: 'Ana' });
  mockSendText.mockResolvedValue({ sent: true, id: 'wamid.out' });
});

describe('takeConversation', () => {
  it('la toma, la audita y se presenta por WhatsApp', async () => {
    expect(await takeConversation(BASE)).toEqual({ status: 'OPEN' });
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        institutionId: 'inst-1',
        status: { in: ['WAITING', 'BOT', 'CLOSED'] },
      },
      data: { status: 'OPEN', assignedToId: 'staff-1', assignedAt: NOW },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'taken' }) })
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('Ana'),
      'pn-1'
    );
  });

  it('si otra persona la tomó antes, lo dice con su nombre', async () => {
    prisma.conversation.updateMany.mockResolvedValue({ count: 0 });
    prisma.conversation.findFirst.mockResolvedValueOnce(row()).mockResolvedValueOnce(
      row({
        status: 'OPEN',
        assignedToId: 'staff-2',
        assignedTo: { givenName: 'Kris', familyName: 'B' },
      })
    );
    await expect(takeConversation(BASE)).rejects.toThrow('Este chat ya lo tomó Kris');
    expect(mockSendText).not.toHaveBeenCalled();
  });
});

describe('replyToConversation', () => {
  it('solo quien la tomó', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-2' })
    );
    await expect(replyToConversation({ ...BASE, body: 'Hola' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('envía y guarda con su autor', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-1' })
    );
    expect(await replyToConversation({ ...BASE, body: '  Hola, Laura ' })).toEqual({ sent: true });
    expect(mockSendText).toHaveBeenCalledWith('573001112233', 'Hola, Laura', 'pn-1');
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: 'OUTBOUND',
        authorId: 'staff-1',
        body: 'Hola, Laura',
      }),
    });
  });

  it('pasadas 24 h desde su último mensaje no deja escribir', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({
        status: 'OPEN',
        assignedToId: 'staff-1',
        lastInboundAt: new Date(NOW.getTime() - 25 * 60 * 60_000),
      })
    );
    await expect(replyToConversation({ ...BASE, body: 'Hola' })).rejects.toThrow('24 horas');
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('si WhatsApp no lo acepta, no se guarda como enviado', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-1' })
    );
    mockSendText.mockResolvedValue({ sent: false, reason: 'not_configured' });
    await expect(replyToConversation({ ...BASE, body: 'Hola' })).rejects.toThrow('not_configured');
    expect(prisma.conversationMessage.create).not.toHaveBeenCalled();
  });
});

describe('closeConversation', () => {
  it('la cierra quien la tomó, con despedida y auditoría', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-1' })
    );
    expect(await closeConversation(BASE)).toEqual({ status: 'CLOSED' });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { status: 'CLOSED', waitingSince: null },
    });
    expect(mockSendText).toHaveBeenCalled();
  });

  it('otra persona no la cierra', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-2' })
    );
    await expect(closeConversation(BASE)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
