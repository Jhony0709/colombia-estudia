/** @jest-environment node */
/**
 * Recordatorios mientras espera asesor (14/11): cada 3 minutos, tres recordatorios y luego la
 * propuesta de escribir por correo; nada si alguien la tomó. SSOT: waiting.service.ts.
 */

const prisma = {
  conversation: { findMany: jest.fn(), updateMany: jest.fn() },
  conversationMessage: { create: jest.fn() },
};
const mockSendText = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  SERVICE_WINDOW_MS: 24 * 60 * 60 * 1000,
  sendText: (...args: unknown[]) => mockSendText(...args),
}));

import {
  REMINDER_EVERY_MS,
  runWaitingReminders,
  waitingMessage,
} from '@/features/messaging/server/waiting.service';

const SINCE = new Date('2026-11-14T15:00:00.000Z');
const at = (minutes: number) => new Date(SINCE.getTime() + minutes * 60_000);
const row = (waitingReminders: number) => ({
  id: 'conv-1',
  institutionId: 'inst-1',
  contact: '573001112233',
  waitingSince: SINCE,
  waitingReminders,
  institution: { whatsappPhoneNumberId: 'pn-1', supportEmail: 'info@alba.test' },
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.conversation.updateMany.mockResolvedValue({ count: 1 });
  mockSendText.mockResolvedValue({ sent: true, id: 'wamid.r' });
});

describe('waitingMessage', () => {
  it('tres recordatorios, luego el correo y después nada', () => {
    expect(waitingMessage(0, 'info@alba.test')).toMatch(/asesor/);
    expect(waitingMessage(2, 'info@alba.test')).not.toContain('@');
    expect(waitingMessage(3, 'info@alba.test')).toContain('info@alba.test');
    expect(waitingMessage(4, 'info@alba.test')).toBeNull();
  });
});

describe('runWaitingReminders', () => {
  it('a los 3 minutos manda el primero, lo cuenta y lo deja en el hilo', async () => {
    prisma.conversation.findMany.mockResolvedValue([row(0)]);
    expect(REMINDER_EVERY_MS).toBe(180_000);
    const report = await runWaitingReminders(at(3));
    expect(report).toEqual({ checked: 1, sent: 1, failed: 0, closed: 1 });
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: 'WAITING', waitingReminders: 0 },
      data: { waitingReminders: { increment: 1 }, lastMessageAt: at(3) },
    });
    expect(mockSendText).toHaveBeenCalledWith('573001112233', expect.any(String), 'pn-1');
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromBot: true, direction: 'OUTBOUND' }),
    });
  });

  it('antes de su turno no manda el siguiente', async () => {
    prisma.conversation.findMany.mockResolvedValue([row(1)]);
    expect((await runWaitingReminders(at(5))).sent).toBe(0);
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('a los 12 minutos propone el correo', async () => {
    prisma.conversation.findMany.mockResolvedValue([row(3)]);
    await runWaitingReminders(at(12));
    expect(mockSendText).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('info@alba.test'),
      'pn-1'
    );
  });

  it('pasadas 24 h sin que nadie la tome, se cierra como sin atender', async () => {
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.conversation.updateMany.mockResolvedValue({ count: 2 });
    const now = at(25 * 60);
    expect((await runWaitingReminders(now)).closed).toBe(2);
    const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    // Sin tocar `waitingSince`: es lo que la bandeja lee como «sin atender».
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'WAITING',
        OR: [
          { lastInboundAt: { lt: stale } },
          { lastInboundAt: null, waitingSince: { lt: stale } },
        ],
      },
      data: { status: 'CLOSED' },
    });
  });

  it('si alguien la tomó entre tanto, no envía', async () => {
    prisma.conversation.findMany.mockResolvedValue([row(0)]);
    prisma.conversation.updateMany.mockResolvedValue({ count: 0 });
    expect((await runWaitingReminders(at(3))).sent).toBe(0);
    expect(mockSendText).not.toHaveBeenCalled();
  });
});
