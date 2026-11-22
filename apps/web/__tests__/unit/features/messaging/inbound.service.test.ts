/** @jest-environment node */
/**
 * Lo que llega por WhatsApp (5/11): todo queda en la conversación; el bot saluda o responde, y
 * «Hablar con un asesor» la deja esperando y avisa a quienes atienden. SSOT:
 * features/messaging/server/inbound.service.ts.
 */

const prisma = {
  institution: { findUnique: jest.fn() },
  conversation: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  conversationMessage: { create: jest.fn(), findFirst: jest.fn() },
};
const tenantDb = { person: { findMany: jest.fn() } };
const mockSendText = jest.fn();
const mockSendButtons = jest.fn((..._args: unknown[]) =>
  Promise.resolve({ sent: true, id: 'wamid.out-b' })
);
const mockSendList = jest.fn();
const mockSendTemplate = jest.fn();
const mockNotifyMany = jest.fn();
const mockAttemptCode = jest.fn();
const mockCreateAccount = jest.fn();

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
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn() } }));
jest.mock('@/features/messaging/server/facts.service', () => ({
  botContext: jest.fn(async () => ({
    siteUrl: 'https://alba.test',
    policyUrl: 'https://alba.test/politica-de-datos',
    facts: jest.requireActual('@/features/messaging/facts').DEFAULT_FACTS,
    introOpen: true,
    advisorsOpen: true,
  })),
}));
jest.mock('@/lib/seo/site-url', () => ({ siteUrl: () => 'https://alba.test' }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  markRead: jest.fn(async () => undefined),
  sendText: (...args: unknown[]) => mockSendText(...args),
  sendList: (...args: unknown[]) => mockSendList(...args),
  sendButtons: (...args: unknown[]) => mockSendButtons(...args),
  sendTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
  staffPersonIds: jest.fn(async () => ['staff-1', 'staff-2']),
}));
jest.mock('@/features/requests/server/whatsapp.service', () => ({
  handleInboundMessage: (...args: unknown[]) => mockAttemptCode(...args),
}));
jest.mock('@/features/messaging/server/chat-account.service', () => ({
  createAccountFromChat: (...args: unknown[]) => mockCreateAccount(...args),
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
  it('un saludo queda guardado y el bot responde con tres caminos', async () => {
    expect(await handleWhatsAppMessage(message())).toBe('menu');

    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv-1',
        direction: 'INBOUND',
        body: 'Buenas tardes',
        externalId: 'wamid.1',
      }),
    });
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('Soy el asistente'),
      expect.arrayContaining([expect.objectContaining({ id: 'opciones' })]),
      'pn-1'
    );
    // Lo que dice el bot también queda en el hilo.
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: 'OUTBOUND', fromBot: true }),
    });
  });

  it('una opción del menú se responde con su texto', async () => {
    expect(await handleWhatsAppMessage(message({ choiceId: 'requisitos' }))).toBe('answered');
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('16 años'),
      expect.any(Array),
      'pn-1'
    );
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('el precio va con botones de respuesta rápida', async () => {
    expect(await handleWhatsAppMessage(message({ choiceId: 'programas' }))).toBe('answered');
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('$890.000'),
      expect.arrayContaining([expect.objectContaining({ id: 'probar' })]),
      'pn-1'
    );
  });

  it('una pregunta escrita a mano llega a su opción sin pasar por el menú', async () => {
    expect(await handleWhatsAppMessage(message({ text: '¿Tienen sede física?' }))).toBe('answered');
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('100 % virtuales'),
      expect.any(Array),
      'pn-1'
    );
    expect(mockSendList).not.toHaveBeenCalled();
  });

  it('«Inscribirme» empieza el formulario pidiendo la autorización de datos', async () => {
    expect(await handleWhatsAppMessage(message({ choiceId: 'inscribirme' }))).toBe('intake');
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { intakeKind: 'ENROLL', intakeStep: 0, intake: {} },
    });
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('https://alba.test/politica-de-datos'),
      [
        { id: 'intake_yes', title: 'Sí, autorizo' },
        { id: 'intake_no', title: 'No' },
      ],
      'pn-1'
    );
  });

  describe('en medio del formulario', () => {
    const inIntake = (intakeStep: number, intake: Record<string, string>) => {
      prisma.conversation.update.mockResolvedValue({
        ...conversation('BOT'),
        intakeKind: 'ENROLL',
        intakeStep,
        intake,
      });
    };

    it('con la autorización guarda la fecha y hace la primera pregunta', async () => {
      inIntake(0, {});
      expect(await handleWhatsAppMessage(message({ choiceId: 'intake_yes' }))).toBe('intake');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: {
          intake: expect.objectContaining({ _consentAt: AT.toISOString() }),
          intakeStep: 1,
        },
      });
      expect(mockSendText).toHaveBeenCalledWith(
        '573001112233',
        expect.stringContaining('nombre completo'),
        'pn-1'
      );
    });

    it('sin autorización sale del formulario sin guardar nada', async () => {
      inIntake(0, {});
      expect(await handleWhatsAppMessage(message({ choiceId: 'intake_no' }))).toBe('answered');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({ intakeKind: null, intakeStep: null }),
      });
    });

    it('una respuesta que no sirve repite la pregunta sin avanzar', async () => {
      inIntake(4, { fullName: 'Laura', phone: '+57300', grade: '8°' });
      expect(await handleWhatsAppMessage(message({ text: 'no tengo' }))).toBe('intake');
      expect(prisma.conversation.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ intakeStep: 5 }) })
      );
    });

    it('confirmar el resumen la deja esperando asesor y avisa con lo que pidió', async () => {
      const data = {
        fullName: 'Laura',
        phone: '+57300',
        grade: '9°',
        adult: 'Sí, 18 o más',
        email: 'l@x.co',
      };
      inIntake(7, data);
      expect(await handleWhatsAppMessage(message({ choiceId: 'intake_yes' }))).toBe('waiting');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          intake: data,
          intakeStep: null,
          status: 'WAITING',
          waitingReminders: 0,
        }),
      });
      expect(mockNotifyMany).toHaveBeenCalledWith(
        'inst-1',
        ['staff-1', 'staff-2'],
        expect.objectContaining({ body: expect.stringContaining('datos de inscripción') })
      );
    });

    it('«cancelar» sale del formulario y vuelve el menú', async () => {
      inIntake(2, { fullName: 'Laura' });
      expect(await handleWhatsAppMessage(message({ text: 'cancelar' }))).toBe('menu');
      expect(mockSendButtons).toHaveBeenCalledWith(
        '573001112233',
        expect.stringContaining('Soy el asistente'),
        expect.any(Array),
        'pn-1'
      );
    });
  });

  it('la segunda vez seguida que no entiende, ofrece una persona (22/11)', async () => {
    prisma.conversationMessage.findFirst.mockResolvedValueOnce({
      body: '¡Hola! 👋 Soy el asistente de ALBA Futuro Educativo. Te ayudo a terminar tu bachillerato 100 % virtual. ¿Qué quieres hacer? [Precios y pagos · Crear mi cuenta · Más opciones]',
    });
    expect(await handleWhatsAppMessage(message({ text: 'ajá' }))).toBe('menu');
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('No te entendí'),
      expect.arrayContaining([expect.objectContaining({ id: 'asesor' })]),
      'pn-1'
    );
  });

  it('el mensaje del botón de la web recibe la bienvenida, no el precio (22/11)', async () => {
    const web = 'Hola 👋 Quiero terminar mi bachillerato con ALBA Futuro Educativo.';
    expect(await handleWhatsAppMessage(message({ text: web }))).toBe('answered');
    expect(mockSendButtons).toHaveBeenCalledWith(
      '573001112233',
      expect.stringContaining('Qué bueno que quieras terminar'),
      expect.any(Array),
      'pn-1'
    );
  });

  describe('crear la cuenta por el chat (22/11)', () => {
    const data = {
      adult: 'Sí, 18 o más',
      fullName: 'Laura Gómez',
      email: 'laura@correo.co',
      birthDate: '1990-12-31',
      phone: '+573001112233',
    };
    beforeEach(() => {
      prisma.conversation.update.mockResolvedValue({
        ...conversation('BOT'),
        intakeKind: 'ACCOUNT',
        intakeStep: 6,
        intake: data,
      });
    });

    it('confirmado el resumen, la crea y le dice que revise su correo', async () => {
      mockCreateAccount.mockResolvedValue({ status: 'sent', email: data.email, enrolled: true });
      expect(await handleWhatsAppMessage(message({ choiceId: 'intake_yes' }))).toBe('answered');
      expect(mockCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({ institutionId: 'inst-1', conversationId: 'conv-1', data })
      );
      expect(mockSendButtons).toHaveBeenCalledWith(
        '573001112233',
        expect.stringContaining('laura@correo.co'),
        expect.any(Array),
        'pn-1'
      );
      expect(mockNotifyMany).not.toHaveBeenCalled();
    });

    it('si el correo ya tiene ficha sin cuenta, pasa a un asesor', async () => {
      mockCreateAccount.mockResolvedValue({ status: 'has_profile' });
      expect(await handleWhatsAppMessage(message({ choiceId: 'intake_yes' }))).toBe('waiting');
      expect(mockNotifyMany).toHaveBeenCalledWith(
        'inst-1',
        ['staff-1', 'staff-2'],
        expect.objectContaining({ body: expect.stringContaining('crear su cuenta') })
      );
    });
  });

  it('«Hablar con un asesor» la deja esperando y avisa a quienes atienden', async () => {
    process.env.WHATSAPP_TEMPLATE_NEW_CHAT = 'nuevo_chat';

    expect(await handleWhatsAppMessage(message({ choiceId: 'asesor' }))).toBe('waiting');

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: {
        status: 'WAITING',
        waitingSince: AT,
        waitingReminders: 0,
        assignedToId: null,
        assignedAt: null,
      },
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

  it('si responde citando un mensaje del chat, queda enlazado a él (22/11)', async () => {
    prisma.conversation.update.mockResolvedValueOnce(conversation('OPEN', 'staff-2'));
    prisma.conversationMessage.findFirst.mockResolvedValueOnce({ id: 'm-out' });
    await handleWhatsAppMessage(message({ replyToExternalId: 'wamid.out' }));
    expect(prisma.conversationMessage.findFirst).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', externalId: 'wamid.out' },
      select: { id: true },
    });
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: 'INBOUND', replyToId: 'm-out' }),
    });
  });

  it('cerrada que vuelve a escribir: la atiende el bot otra vez', async () => {
    prisma.conversation.update.mockResolvedValueOnce(conversation('CLOSED', 'staff-2'));
    expect(await handleWhatsAppMessage(message())).toBe('menu');
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: expect.objectContaining({
        status: 'BOT',
        assignedToId: null,
        assignedAt: null,
        intakeKind: null,
        intakeStep: null,
      }),
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
