/** @jest-environment node */
/**
 * La bandeja (5/11): el primero que toma el chat lo atiende; solo esa persona responde y cierra,
 * y en WhatsApp solo dentro de las 24 h. SSOT: features/messaging/server/conversations.service.ts.
 */

const prisma = {
  conversation: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  conversationMessage: { create: jest.fn(), findFirst: jest.fn() },
  institution: { findUnique: jest.fn() },
  person: { findFirst: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};
const mockSendText = jest.fn();
const mockSendButtons = jest.fn();
const mockSendTemplate = jest.fn();
const tenantTx = {
  person: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
  membership: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};
const tenantDb = {
  ...tenantTx,
  $transaction: jest.fn(async (fn: (tx: typeof tenantTx) => unknown) => fn(tenantTx)),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
  createTenantClient: () => tenantDb,
}));
const mockStaffLink = jest.fn();
jest.mock('@/features/billing/server/account.service', () => ({
  createStaffLink: (...args: unknown[]) => mockStaffLink(...args),
  nextChargeOf: jest.fn(),
}));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  SERVICE_WINDOW_MS: 24 * 60 * 60 * 1000,
  sendText: (...args: unknown[]) => mockSendText(...args),
  sendButtons: (...args: unknown[]) => mockSendButtons(...args),
  sendTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));

import {
  closeConversation,
  conversationsPulse,
  createPersonFromIntake,
  replyToConversation,
  sendFollowUp,
  sendPaymentLink,
  takeConversation,
} from '@/features/messaging/server/conversations.service';

const NOW = new Date('2026-11-05T15:00:00.000Z');
const BASE = { institutionId: 'inst-1', actorId: 'staff-1', conversationId: 'conv-1', now: NOW };
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-1',
  channel: 'WHATSAPP',
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
      'pn-1',
      undefined
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
    expect(mockSendText).toHaveBeenCalledWith('573001112233', 'Hola, Laura', 'pn-1', undefined);
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

  it('después de la despedida, la encuesta de tres botones queda en el hilo (22/11)', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-1' })
    );
    mockSendButtons.mockResolvedValue({ sent: true, id: 'wamid.csat' });
    await closeConversation(BASE);
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      '¿Cómo te atendimos hoy?',
      [
        { id: 'csat_5', title: '😀 Muy bien' },
        { id: 'csat_3', title: '😐 Regular' },
        { id: 'csat_1', title: '😕 Mal' },
      ],
      'pn-1'
    );
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromBot: true, externalId: 'wamid.csat' }),
    });
  });

  it('fuera de las 24 h no hay encuesta: no se le puede escribir', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({
        status: 'OPEN',
        assignedToId: 'staff-1',
        lastInboundAt: new Date(NOW.getTime() - 25 * 60 * 60_000),
      })
    );
    await closeConversation(BASE);
    expect(mockSendButtons).not.toHaveBeenCalled();
  });
});

describe('createPersonFromIntake', () => {
  const intake = {
    personId: null,
    intakeKind: 'ENROLL',
    intakeStep: null,
    intake: { fullName: 'Laura María Gómez', phone: '+573001112233', email: 'Laura@Correo.co' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tenantDb.person.findFirst.mockResolvedValue(null);
    tenantDb.person.create.mockResolvedValue({ id: 'p-9', code: 'PER-0009' });
  });

  it('crea la persona con su rol de estudiante y enlaza la conversación', async () => {
    prisma.conversation.findFirst.mockResolvedValue(intake);
    expect(await createPersonFromIntake(BASE)).toEqual({ personCode: 'PER-0009', created: true });
    expect(tenantDb.person.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        givenName: 'Laura',
        familyName: 'María Gómez',
        email: 'laura@correo.co',
        phone: '+573001112233',
      }),
      select: { id: true, code: true },
    });
    expect(tenantDb.membership.create).toHaveBeenCalledWith({
      data: { institutionId: 'inst-1', personId: 'p-9', role: 'STUDENT' },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { personId: 'p-9' },
    });
  });

  it('si ya hay una persona con ese correo, solo la enlaza', async () => {
    prisma.conversation.findFirst.mockResolvedValue(intake);
    tenantDb.person.findFirst.mockResolvedValue({ id: 'p-1', code: 'PER-0001' });
    expect(await createPersonFromIntake(BASE)).toEqual({ personCode: 'PER-0001', created: false });
    expect(tenantDb.person.create).not.toHaveBeenCalled();
  });

  it('sin datos de inscripción completos no crea nada', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ ...intake, intakeStep: 2 });
    await expect(createPersonFromIntake(BASE)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('sendPaymentLink', () => {
  const mine = (overrides: Record<string, unknown> = {}) =>
    row({
      status: 'OPEN',
      assignedToId: 'staff-1',
      person: { id: 'per-1', email: 'a@b.co' },
      ...overrides,
    });
  const send = (delivery: 'email' | 'chat') =>
    sendPaymentLink({ ...BASE, delivery, origin: 'https://alba.test' });

  beforeEach(() => {
    prisma.institution.findUnique.mockResolvedValue({ whatsappPhoneNumberId: 'pn-1' });
    mockSendText.mockResolvedValue({ sent: true, id: 'wamid.link' });
    mockStaffLink.mockResolvedValue({
      installmentId: 'i2',
      position: 2,
      amount: 90_000,
      dueOn: '2026-12-05',
      url: 'https://checkout.bold.co/LNK_9',
      reference: 'ce-i2-abc',
    });
  });

  it('al chat: deja el link en WhatsApp como mensaje del asesor y lo audita', async () => {
    prisma.conversation.findFirst.mockResolvedValue(mine());
    await expect(send('chat')).resolves.toEqual({ delivery: 'chat', amount: 90_000 });
    expect(mockStaffLink).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'per-1', delivery: 'chat', payerEmail: 'a@b.co' })
    );
    const [to, body] = mockSendText.mock.calls[0];
    expect(to).toBe('573001112233');
    expect(body).toContain('https://checkout.bold.co/LNK_9');
    expect(body).toContain('cuota 2');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'payment_link_sent',
        after: { delivery: 'chat', reference: 'ce-i2-abc', installmentId: 'i2' },
      }),
    });
  });

  it('al correo: lo envía Bold y no se escribe nada en el chat', async () => {
    prisma.conversation.findFirst.mockResolvedValue(mine());
    await expect(send('email')).resolves.toEqual({ delivery: 'email', amount: 90_000 });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('fuera de las 24 h no crea el link para el chat; por correo sí', async () => {
    const old = mine({ lastInboundAt: new Date(NOW.getTime() - 25 * 3600_000) });
    prisma.conversation.findFirst.mockResolvedValue(old);
    await expect(send('chat')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockStaffLink).not.toHaveBeenCalled();
    await expect(send('email')).resolves.toMatchObject({ delivery: 'email' });
  });

  it('solo quien tomó el chat, y con una persona enlazada', async () => {
    prisma.conversation.findFirst.mockResolvedValue(mine({ assignedToId: 'otro' }));
    await expect(send('chat')).rejects.toMatchObject({ code: 'CONFLICT' });
    prisma.conversation.findFirst.mockResolvedValue(mine({ person: null }));
    await expect(send('chat')).rejects.toMatchObject({ code: 'CONFLICT' });
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(send('chat')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockStaffLink).not.toHaveBeenCalled();
  });
});

describe('conversationsPulse', () => {
  it('la huella de un chat cambia con un mensaje, con quién lo atiende o con su estado', async () => {
    const base = { status: 'OPEN', assignedToId: 'staff-1', personId: null, lastMessageAt: NOW };
    prisma.conversation.findFirst.mockResolvedValue(base);
    const first = await conversationsPulse({ institutionId: 'inst-1', conversationId: 'conv-1' });
    prisma.conversation.findFirst.mockResolvedValue({
      ...base,
      lastMessageAt: new Date(NOW.getTime() + 1000),
    });
    const second = await conversationsPulse({ institutionId: 'inst-1', conversationId: 'conv-1' });
    expect(second).not.toBe(first);
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(
      conversationsPulse({ institutionId: 'inst-1', conversationId: 'otra' })
    ).resolves.toBe('');
  });

  it('la de la bandeja junta el último movimiento y cuántos hay en cada estado', async () => {
    prisma.conversation.aggregate.mockResolvedValue({ _max: { lastMessageAt: NOW } });
    prisma.conversation.groupBy.mockResolvedValue([
      { status: 'WAITING', _count: 2 },
      { status: 'BOT', _count: 5 },
    ]);
    await expect(conversationsPulse({ institutionId: 'inst-1' })).resolves.toBe(
      `${NOW.getTime()}|BOT:5|WAITING:2`
    );
  });
});

describe('replyToConversation: cita y botones (22/11)', () => {
  beforeEach(() => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-1' })
    );
    mockSendButtons.mockResolvedValue({ sent: true, id: 'wamid.btn' });
  });

  it('cita un mensaje del chat: WhatsApp lo recibe con su wamid y queda enlazado', async () => {
    prisma.conversationMessage.findFirst.mockResolvedValue({ id: 'm-in', externalId: 'wamid.in' });
    await replyToConversation({ ...BASE, body: 'Claro', replyToId: 'm-in' });
    expect(prisma.conversationMessage.findFirst).toHaveBeenCalledWith({
      where: { id: 'm-in', conversationId: 'conv-1' },
      select: { id: true, externalId: true },
    });
    expect(mockSendText).toHaveBeenCalledWith('573001112233', 'Claro', 'pn-1', 'wamid.in');
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ replyToId: 'm-in' }),
    });
  });

  it('no cita un mensaje de otro chat', async () => {
    prisma.conversationMessage.findFirst.mockResolvedValue(null);
    await expect(
      replyToConversation({ ...BASE, body: 'Claro', replyToId: 'm-otro' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('con botones envía un mensaje interactivo y los guarda', async () => {
    await replyToConversation({ ...BASE, body: '¿Te sirve el martes?', buttons: ['Sí', ' No '] });
    const replies = [
      { id: 'agent:1', title: 'Sí' },
      { id: 'agent:2', title: 'No' },
    ];
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      '¿Te sirve el martes?',
      replies,
      'pn-1',
      undefined
    );
    expect(mockSendText).not.toHaveBeenCalled();
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ buttons: replies, externalId: 'wamid.btn' }),
    });
  });

  it('más de 3 botones, repetidos o largos no salen', async () => {
    for (const buttons of [['a', 'b', 'c', 'd'], ['Sí', 'Sí'], ['x'.repeat(21)]]) {
      await expect(replyToConversation({ ...BASE, body: 'Hola', buttons })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    }
    expect(mockSendButtons).not.toHaveBeenCalled();
  });
});

describe('sendFollowUp (22/11)', () => {
  const OUT = new Date(NOW.getTime() - 30 * 60 * 60_000);

  beforeEach(() => {
    process.env.WHATSAPP_TEMPLATE_FOLLOW_UP = 'retomar_chat';
    prisma.conversation.findFirst.mockResolvedValue(
      row({
        status: 'OPEN',
        assignedToId: 'staff-1',
        lastInboundAt: OUT,
        contactName: 'Lau',
        person: { givenName: 'Laura' },
      })
    );
    prisma.auditLog.findFirst.mockResolvedValue(null);
    mockSendTemplate.mockResolvedValue({ sent: true, id: 'wamid.tpl' });
  });
  afterEach(() => {
    delete process.env.WHATSAPP_TEMPLATE_FOLLOW_UP;
  });

  it('fuera de las 24 h envía la plantilla con su nombre, la deja en el hilo y la audita', async () => {
    expect(await sendFollowUp(BASE)).toEqual({ sent: true });
    expect(mockSendTemplate).toHaveBeenCalledWith('573001112233', 'retomar_chat', ['Laura'], {
      phoneNumberId: 'pn-1',
    });
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: 'OUTBOUND', externalId: 'wamid.tpl' }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'follow_up_sent' }) })
    );
  });

  it('dentro de las 24 h, sin plantilla configurada o si ya se envió hoy, no sale', async () => {
    prisma.conversation.findFirst.mockResolvedValueOnce(
      row({ status: 'OPEN', assignedToId: 'staff-1', person: null })
    );
    await expect(sendFollowUp(BASE)).rejects.toThrow('menos de 24 horas');

    prisma.auditLog.findFirst.mockResolvedValueOnce({ id: 'a-1' });
    await expect(sendFollowUp(BASE)).rejects.toThrow('Ya se le envió');

    delete process.env.WHATSAPP_TEMPLATE_FOLLOW_UP;
    await expect(sendFollowUp(BASE)).rejects.toThrow('No hay plantilla');
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('solo quien tomó el chat', async () => {
    prisma.conversation.findFirst.mockResolvedValue(
      row({ status: 'OPEN', assignedToId: 'staff-2', lastInboundAt: OUT })
    );
    await expect(sendFollowUp(BASE)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
