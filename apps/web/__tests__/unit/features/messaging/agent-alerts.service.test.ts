/** @jest-environment node */
/**
 * Avisos a quien atiende (27/11): un mensaje nuevo solo si no tiene el chat abierto, y
 * recordatorios a los 10 y 30 min de lo que sigue esperando. Campana primero; el WhatsApp
 * sale solo si la campana creó un aviso nuevo. SSOT: features/messaging/server/agent-alerts.service.ts.
 */

const mockPrisma = {
  conversation: { updateMany: jest.fn(), findMany: jest.fn() },
  person: { findMany: jest.fn() },
};
const mockNotifyMany = jest.fn();
const mockStaff = jest.fn();
const mockSendTemplate = jest.fn();
const mockAdvisorsOpen = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return mockPrisma;
  },
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  SERVICE_WINDOW_MS: 24 * 60 * 60 * 1000,
  sendTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  staffPersonIds: (...args: unknown[]) => mockStaff(...args),
}));
jest.mock('@/features/requests/server/requests.service', () => ({
  whatsappIdOf: (phone: string | null) => (phone ? `57${phone}` : null),
}));
jest.mock('@/features/messaging/facts', () => ({
  advisorsOpen: (...args: unknown[]) => mockAdvisorsOpen(...args),
}));

import {
  alertAssignedAgent,
  markAgentSeen,
  runAgentReminders,
} from '@/features/messaging/server/agent-alerts.service';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.WHATSAPP_TEMPLATE_PENDING_MESSAGE = 'mensaje_pendiente';
  mockNotifyMany.mockResolvedValue({ created: 1 });
  mockSendTemplate.mockResolvedValue({ sent: true, id: 'w' });
  mockPrisma.person.findMany.mockResolvedValue([{ phone: '3001112233' }]);
  mockStaff.mockResolvedValue(['ops-1', 'admin-1']);
  mockAdvisorsOpen.mockReturnValue(true);
});
afterEach(() => delete process.env.WHATSAPP_TEMPLATE_PENDING_MESSAGE);

describe('markAgentSeen', () => {
  it('solo marca el chat si es de quien lo mira', async () => {
    await markAgentSeen({
      institutionId: 'inst-1',
      conversationId: 'c-1',
      actorId: 's-1',
      now: NOW,
    });
    expect(mockPrisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'c-1', institutionId: 'inst-1', assignedToId: 's-1' },
      data: { agentSeenAt: NOW },
    });
  });
});

describe('alertAssignedAgent', () => {
  const conversation = (agentSeenAt: Date | null, assignedToId: string | null = 's-1') => ({
    id: 'c-1',
    institutionId: 'inst-1',
    contact: '573009998877',
    contactName: 'Laura',
    assignedToId,
    agentSeenAt,
  });
  const run = (agentSeenAt: Date | null, assignedToId?: string | null) =>
    alertAssignedAgent({
      conversation: conversation(agentSeenAt, assignedToId),
      body: 'Hola, ¿siguen ahí?',
      phoneNumberId: 'pn-1',
      now: NOW,
    });

  it('sin el chat abierto: campana y plantilla a su WhatsApp, con botón al chat', async () => {
    await run(ago(5 * MIN));

    expect(mockNotifyMany).toHaveBeenCalledWith('inst-1', ['s-1'], {
      type: 'conversation_message',
      title: 'Mensaje de Laura',
      body: 'Hola, ¿siguen ahí?',
      href: '/mensajes/c-1',
      dedupeKey: `conversation_message:c-1:${Math.floor(NOW.getTime() / (30 * MIN))}`,
    });
    // Solo a quien sigue en el equipo.
    expect(mockPrisma.person.findMany).toHaveBeenCalledWith({
      where: {
        institutionId: 'inst-1',
        id: { in: ['s-1'] },
        memberships: {
          some: { institutionId: 'inst-1', revokedAt: null, role: { in: ['OPERATIONS', 'ADMIN'] } },
        },
      },
      select: { phone: true },
    });
    expect(mockSendTemplate).toHaveBeenCalledWith('573001112233', 'mensaje_pendiente', ['Laura'], {
      phoneNumberId: 'pn-1',
      urlSuffix: 'c-1',
    });
  });

  it('un nombre de perfil con saltos de línea o muy largo se limpia para la plantilla', async () => {
    await alertAssignedAgent({
      conversation: { ...conversation(null), contactName: `  Laura\n\nGómez   ${'x'.repeat(80)}` },
      body: 'Hola',
      phoneNumberId: 'pn-1',
      now: NOW,
    });
    const [name] = mockSendTemplate.mock.calls[0][2] as string[];
    expect(name).not.toMatch(/\n|\s{2,}/);
    expect(name!.startsWith('Laura Gómez x')).toBe(true);
    expect(name!.length).toBeLessThanOrEqual(60);
  });

  it('con el chat abierto (visto hace menos de 30 s) no avisa', async () => {
    await run(ago(10_000));
    expect(mockNotifyMany).not.toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('si la campana ya avisó en esta media hora, no repite el WhatsApp', async () => {
    mockNotifyMany.mockResolvedValue({ created: 0 });
    await run(null);
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('sin plantilla configurada, solo la campana', async () => {
    delete process.env.WHATSAPP_TEMPLATE_PENDING_MESSAGE;
    await run(null);
    expect(mockNotifyMany).toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('de noche, solo la campana: el WhatsApp sale con el recordatorio al abrir', async () => {
    mockAdvisorsOpen.mockReturnValue(false);
    await run(null);
    expect(mockNotifyMany).toHaveBeenCalled();
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('sin asesor asignado no hay a quién avisar', async () => {
    await run(null, null);
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });
});

describe('runAgentReminders', () => {
  const row = (overrides: Record<string, unknown>) => ({
    id: 'c-1',
    institutionId: 'inst-1',
    status: 'WAITING',
    contact: '573009998877',
    contactName: 'Laura',
    assignedToId: null,
    agentSeenAt: null,
    waitingSince: ago(12 * MIN),
    lastInboundAt: ago(12 * MIN),
    assignedAt: null,
    institution: { whatsappPhoneNumberId: 'pn-1', whatsappAgentPhones: ['573102502207'] },
    messages: [{ direction: 'INBOUND' }],
    ...overrides,
  });

  it('fuera del horario de asesores no recuerda nada', async () => {
    mockAdvisorsOpen.mockReturnValue(false);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 0 });
    expect(mockPrisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it('busca los que esperan desde hace 10 min y los tomados con mensaje sin responder', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([]);
    await runAgentReminders(NOW);
    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { status: 'WAITING', waitingSince: { lte: ago(10 * MIN) } },
            {
              status: 'OPEN',
              assignedToId: { not: null },
              lastInboundAt: { lte: ago(10 * MIN), gte: ago(24 * 60 * MIN) },
            },
          ],
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 200,
      })
    );
  });

  it('el aviso del bot fuera de horario no cuenta como respuesta', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([]);
    await runAgentReminders(NOW);
    expect(mockPrisma.conversation.findMany.mock.calls[0][0].select.messages).toEqual({
      where: { fromBot: false },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { direction: true },
    });
  });

  it('sin tomar a los 10 min: campana al equipo y plantilla a los WhatsApp de asesores', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([row({})]);

    expect(await runAgentReminders(NOW)).toEqual({ waiting: 1, unanswered: 0 });
    expect(mockStaff).toHaveBeenCalledWith('inst-1', ['OPERATIONS', 'ADMIN']);
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['ops-1', 'admin-1'],
      expect.objectContaining({
        type: 'conversation_waiting',
        title: 'Chat sin tomar',
        body: 'Laura lleva 12 min esperando asesor por WhatsApp.',
        dedupeKey: `conversation_reminder:c-1:${ago(12 * MIN).getTime()}:1`,
      })
    );
    expect(mockSendTemplate).toHaveBeenCalledWith('573102502207', 'mensaje_pendiente', ['Laura'], {
      phoneNumberId: 'pn-1',
      urlSuffix: 'c-1',
    });
  });

  it('a los 30 min es el segundo recordatorio; ya avisado, no repite', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([row({ waitingSince: ago(31 * MIN) })]);
    await runAgentReminders(NOW);
    expect(mockNotifyMany.mock.calls[0][2].dedupeKey).toMatch(/:2$/);

    jest.clearAllMocks();
    mockNotifyMany.mockResolvedValue({ created: 0 });
    mockPrisma.conversation.findMany.mockResolvedValue([row({ waitingSince: ago(32 * MIN) })]);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 0 });
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('tomado y sin respuesta: solo a quien lo atiende, a su WhatsApp', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([
      row({ status: 'OPEN', assignedToId: 's-1', waitingSince: null }),
    ]);

    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 1 });
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['s-1'],
      expect.objectContaining({
        type: 'conversation_message',
        title: 'Laura sigue esperando respuesta',
        body: 'Su último mensaje lleva 12 min sin respuesta.',
      })
    );
    expect(mockSendTemplate).toHaveBeenCalledWith(
      '573001112233',
      'mensaje_pendiente',
      ['Laura'],
      expect.anything()
    );
  });

  it('tomado hace poco: cuenta desde que lo tomó, no desde el mensaje viejo', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([
      row({
        status: 'OPEN',
        assignedToId: 's-1',
        lastInboundAt: ago(40 * MIN),
        assignedAt: ago(3 * MIN),
      }),
    ]);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 0 });

    mockPrisma.conversation.findMany.mockResolvedValue([
      row({
        status: 'OPEN',
        assignedToId: 's-1',
        lastInboundAt: ago(40 * MIN),
        assignedAt: ago(11 * MIN),
      }),
    ]);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 1 });
    expect(mockNotifyMany.mock.calls[0][2].dedupeKey).toBe(
      `conversation_reminder:c-1:${ago(11 * MIN).getTime()}:1`
    );
  });

  it('tomado: si ya respondieron o lo tiene abierto, no recuerda', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([
      row({ status: 'OPEN', assignedToId: 's-1', messages: [{ direction: 'OUTBOUND' }] }),
      row({ id: 'c-2', status: 'OPEN', assignedToId: 's-1', agentSeenAt: ago(5_000) }),
    ]);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 0 });
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });

  it('antes de los 10 min no hay nada que recordar', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([row({ waitingSince: ago(9 * MIN) })]);
    expect(await runAgentReminders(NOW)).toEqual({ waiting: 0, unanswered: 0 });
  });
});
