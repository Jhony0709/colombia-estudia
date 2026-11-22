/** @jest-environment node */
/**
 * Conversaciones completas con el bot (22/11): el servicio real (`inbound.service.ts`), el bot y
 * el formulario reales, contra una base en memoria. Cada mensaje que sale se revisa contra los
 * límites de WhatsApp. SSOT: features/messaging/{bot,intake}.ts, server/inbound.service.ts.
 */

type Row = Record<string, unknown>;
type Out = { kind: 'text' | 'buttons' | 'list'; body: string; options: string[]; ids: string[] };

const store: { conv: Row | null; messages: Row[] } = { conv: null, messages: [] };
const outbox: Out[] = [];
const mockCreateAccount = jest.fn();
const mockNotify = jest.fn();
const mockAudit = jest.fn();
const mockResend = jest.fn();
const mockMarkRead = jest.fn(async () => undefined);

const LIMITS = { body: 1024, button: 20, row: 24, description: 72, listButton: 20, rows: 10 };

function capture(
  kind: Out['kind'],
  body: string,
  items: Array<{ id: string; title: string; description?: string }>
) {
  expect(body.length).toBeGreaterThan(0);
  expect(body.length).toBeLessThanOrEqual(kind === 'text' ? 4096 : LIMITS.body);
  for (const o of items) {
    expect(o.title.length).toBeLessThanOrEqual(kind === 'list' ? LIMITS.row : LIMITS.button);
    if (o.description) expect(o.description.length).toBeLessThanOrEqual(LIMITS.description);
  }
  expect(new Set(items.map((o) => o.id)).size).toBe(items.length);
  outbox.push({ kind, body, options: items.map((o) => o.title), ids: items.map((o) => o.id) });
  return Promise.resolve({ sent: true, id: `wamid.out.${outbox.length}` });
}

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/errors', () => ({
  isUniqueViolation: (err: unknown) => (err as { unique?: boolean })?.unique === true,
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/whatsapp/cloud-api', () => ({
  markRead: (...args: unknown[]) => mockMarkRead(...(args as [])),
  sendText: (_to: string, body: string) => capture('text', body, []),
  sendButtons: (_to: string, body: string, buttons: Array<{ id: string; title: string }>) =>
    capture('buttons', body, buttons),
  sendList: (
    _to: string,
    list: { body: string; button: string; options: Array<{ id: string; title: string }> }
  ) => {
    expect(list.button.length).toBeLessThanOrEqual(LIMITS.listButton);
    expect(list.options.length).toBeLessThanOrEqual(LIMITS.rows);
    return capture('list', list.body, list.options);
  },
  sendTemplate: jest.fn(async () => ({ sent: true, id: 'wamid.tpl' })),
}));
jest.mock('@/features/messaging/server/facts.service', () => ({
  botContext: jest.fn(async () => ({
    siteUrl: 'https://alba.test',
    policyUrl: 'https://alba.test/politica-de-datos',
    facts: jest.requireActual('@/features/messaging/facts').DEFAULT_FACTS,
    introOpen: true,
    advisorsOpen: true,
  })),
}));
jest.mock('@/features/messaging/server/chat-account.service', () => ({
  createAccountFromChat: (...args: unknown[]) => mockCreateAccount(...args),
  resendAccountEmail: (...args: unknown[]) => mockResend(...args),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notifyMany: (...args: unknown[]) => mockNotify(...args),
  staffPersonIds: jest.fn(async () => ['staff-1']),
}));
jest.mock('@/features/requests/server/whatsapp.service', () => ({
  handleInboundMessage: jest.fn(async () => 'no_code'),
}));
jest.mock('@/features/requests/server/requests.service', () => ({ whatsappIdOf: () => null }));
jest.mock('@/lib/db/tenant', () => {
  const { JSON_NULL } = jest.requireActual('@/lib/db/prisma');
  const apply = (data: Row) => {
    for (const [k, v] of Object.entries(data)) store.conv![k] = v === JSON_NULL ? null : v;
    return { ...store.conv };
  };
  return {
    createTenantClient: () => ({ person: { findMany: jest.fn(async () => []) } }),
    prisma: {
      auditLog: { create: (...args: unknown[]) => mockAudit(...args) },
      institution: {
        findUnique: jest.fn(async () => ({
          id: 'inst-1',
          name: 'ALBA Futuro Educativo',
          whatsappAgentPhones: [],
        })),
      },
      conversation: {
        findUnique: jest.fn(async () => (store.conv ? { id: store.conv.id } : null)),
        create: jest.fn(async ({ data }: { data: Row }) => {
          store.conv = {
            id: 'conv-1',
            status: 'BOT',
            assignedToId: null,
            intakeKind: null,
            intakeStep: null,
            intake: null,
            ...data,
          };
          return { ...store.conv };
        }),
        update: jest.fn(async ({ data }: { data: Row }) => apply(data)),
      },
      conversationMessage: {
        create: jest.fn(async ({ data }: { data: Row }) => {
          if (data.externalId && store.messages.some((m) => m.externalId === data.externalId)) {
            throw { unique: true };
          }
          store.messages.push({ ...data, seq: store.messages.length });
          return data;
        }),
        updateMany: jest.fn(
          async ({ where, data }: { where: { createdAt: { gte: Date } } & Row; data: Row }) => {
            const hits = store.messages.filter(
              (m) =>
                m.conversationId === where.conversationId &&
                m.direction === where.direction &&
                (m.createdAt as Date) >= where.createdAt.gte
            );
            for (const m of hits) Object.assign(m, data);
            return { count: hits.length };
          }
        ),
        findFirst: jest.fn(async ({ where }: { where: Row }) => {
          const hits = store.messages.filter((m) =>
            Object.entries(where).every(([k, v]) => m[k] === v || (k === 'fromBot' && !!m[k] === v))
          );
          return hits.sort((a, b) => (b.seq as number) - (a.seq as number))[0] ?? null;
        }),
      },
    },
  };
});

import { handleWhatsAppMessage } from '@/features/messaging/server/inbound.service';

let n = 0;
/** Escribe (o toca un botón) y devuelve lo que el bot contestó a ese mensaje. */
async function says(text: string, choiceId: string | null = null, id?: string) {
  const before = outbox.length;
  n += 1;
  const outcome = await handleWhatsAppMessage({
    id: id ?? `wamid.in.${n}`,
    from: '573001112233',
    name: 'Laura',
    phoneNumberId: 'pn-1',
    text,
    choiceId,
    at: new Date(Date.UTC(2026, 10, 22, 15, 0, n)),
  });
  return { outcome, replies: outbox.slice(before) };
}
/** Toca el botón u opción con ese título en la última respuesta. */
async function taps(title: string) {
  const last = outbox[outbox.length - 1]!;
  const i = last.options.indexOf(title);
  if (i === -1) throw new Error(`«${title}» no está en [${last.options.join(' · ')}]`);
  return says(title, last.ids[i]);
}
const last = () => outbox[outbox.length - 1]!;

beforeEach(() => {
  store.conv = null;
  store.messages = [];
  outbox.length = 0;
  mockCreateAccount.mockReset();
  mockAudit.mockReset();
  mockMarkRead.mockClear();
  mockNotify.mockReset();
});

describe('escenarios', () => {
  it('desde la web: bienvenida → precios → crear la cuenta, con errores y una corrección', async () => {
    const { replies } = await says(
      'Hola 👋 Quiero terminar mi bachillerato con ALBA Futuro Educativo.'
    );
    expect(replies[0]!.body).toContain('Qué bueno que quieras terminar');
    expect(replies[0]!.body).not.toContain('$');

    expect((await taps('Precios y pagos')).replies[0]!.body).toContain('$890.000');
    expect((await taps('Crear mi cuenta')).replies[0]!.body).toContain('politica-de-datos');
    expect((await taps('Sí, autorizo')).replies[0]!.body).toContain('mayor de edad');
    await says('si');
    expect((await says('Laura')).replies[0]!.body).toContain('nombre y tu apellido');
    await says('Laura Gómez');
    expect((await says('laura arroba correo')).replies[0]!.body).toContain('no parece válido');
    await says('laura@correo.co');
    expect((await says('31/02/1990')).replies[0]!.body).toContain('no es válida');
    const summary = (await says('31/12/1990')).replies[0]!;
    expect(summary.body).toContain('• Correo: laura@correo.co');
    expect(summary.body).toContain('• Fecha de nacimiento: 31/12/1990');
    expect(summary.body).toContain('• Teléfono: +573001112233');

    await taps('Corregir');
    expect(last().options).not.toContain('Mayor de edad');
    await taps('Correo');
    expect((await says('otra@correo.co')).replies[0]!.body).toContain('• Correo: otra@correo.co');

    mockCreateAccount.mockResolvedValue({
      status: 'sent',
      email: 'otra@correo.co',
      enrolled: true,
    });
    const done = await taps('Sí, enviar');
    expect(done.outcome).toBe('answered');
    expect(mockCreateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'otra@correo.co', birthDate: '1990-12-31' }),
      })
    );
    expect(done.replies.map((r) => r.body).join('\n')).toContain('Confirmar mi correo');
    expect(store.conv!.intakeStep).toBeNull();
    expect(store.conv!.status).toBe('BOT');
  });

  it('un menor no deja datos: sale del formulario y va a /registro', async () => {
    await says('Quiero crear mi cuenta');
    await taps('Sí, autorizo');
    const r = await taps('No, soy menor');
    expect(r.replies[0]!.body).toContain('https://alba.test/registro');
    expect(store.conv!.intakeKind).toBeNull();
    expect(store.conv!.intake).toBeNull();
  });

  it('dice que es mayor pero la fecha dice otra cosa: también sale sin guardar', async () => {
    await says('Quiero crear mi cuenta');
    await says('acepto');
    await says('sí');
    await says('Ana Ruiz');
    await says('ana@correo.co');
    const r = await says('01/01/2012');
    expect(r.replies[0]!.body).toContain('menor de edad');
    expect(r.replies[0]!.options).toEqual(['Hablar con asesor', 'Más opciones']);
    expect(store.conv!.intake).toBeNull();
    // Lo que escribió desde la autorización sale del hilo; lo de antes queda.
    const inbound = store.messages.filter((m) => m.direction === 'INBOUND').map((m) => m.body);
    expect(inbound.join(' ')).not.toMatch(/Ana Ruiz|ana@correo|2012/);
    expect(inbound[0]).toBe('Quiero crear mi cuenta');
    expect(mockCreateAccount).not.toHaveBeenCalled();
  });

  it('sin autorización no se guarda nada', async () => {
    await says('Quiero crear mi cuenta');
    const r = await taps('No');
    expect(r.replies[0]!.body).toContain('no te pedimos ningún dato');
    expect(r.replies[0]!.options).toContain('Hablar con asesor');
    expect(store.conv!.intakeKind).toBeNull();
  });

  it('en medio del formulario: una foto, «menú» y un botón viejo lo sacan o lo repiten bien', async () => {
    await says('Quiero inscribirme');
    await taps('Sí, autorizo');
    expect((await says('[image]')).replies[0]!.body).toContain('como texto');
    expect(store.conv!.intakeStep).toBe(1);
    const menu = await says('menú');
    expect(menu.replies[0]!.body).toContain('Soy el asistente');
    expect(store.conv!.intakeKind).toBeNull();

    await says('Quiero inscribirme');
    await taps('Sí, autorizo');
    // Un botón de un mensaje anterior que no es del formulario: lo saca y responde eso.
    const old = await says('Precios y pagos', 'programas');
    expect(old.replies[0]!.body).toContain('$890.000');
    expect(store.conv!.intakeKind).toBeNull();
  });

  it('inscripción de un menor: pide el acudiente, el resumen lo muestra y pasa a asesor', async () => {
    await says('Quiero matricularme');
    await taps('Sí, autorizo');
    await says('Pedro Pérez');
    const grade = await says('8');
    expect(grade.replies[0]!.body).toContain('mayor de edad');
    expect((await taps('No, soy menor')).replies[0]!.body).toContain('acudiente');
    await says('Rosa Pérez 3001112233');
    const summary = (await says('pedro@correo.co')).replies[0]!;
    expect(summary.body).toContain('• Último grado aprobado: 8°');
    expect(summary.body).toContain('• Acudiente: Rosa Pérez 3001112233');
    const done = await taps('Sí, enviar');
    expect(done.outcome).toBe('waiting');
    expect(store.conv!.status).toBe('WAITING');
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      ['staff-1'],
      expect.objectContaining({ body: expect.stringContaining('datos de inscripción') })
    );
  });

  it('inscripción de un adulto: no pregunta acudiente ni teléfono', async () => {
    await says('Quiero matricularme');
    await taps('Sí, autorizo');
    await says('Laura Gómez');
    await taps('11° sin graduarme');
    const next = await taps('Sí, 18 o más');
    expect(next.replies[0]!.body).toContain('correo');
    const summary = (await says('laura@correo.co')).replies[0]!;
    expect(summary.body).not.toContain('Acudiente');
    expect(summary.body).toContain('+573001112233');
  });

  it('no entiende dos veces: ofrece una persona, y «Hablar con asesor» la deja en la fila', async () => {
    expect((await says('ajá')).replies[0]!.body).toContain('Soy el asistente');
    const second = await says('mmm');
    expect(second.replies[0]!.body).toContain('No te entendí');
    const handoff = await taps('Hablar con asesor');
    expect(handoff.outcome).toBe('waiting');
    expect(store.conv!.status).toBe('WAITING');
  });

  it('«Más opciones» abre la lista y cada fila responde', async () => {
    await says('hola');
    const list = await taps('Más opciones');
    expect(list.replies[0]!.kind).toBe('list');
    expect(list.replies[0]!.options).toHaveLength(10);
    const pay = await taps('Formas de pago');
    expect(pay.replies[0]!.body).toContain('Nequi');
    expect(pay.replies[0]!.kind).toBe('buttons');
  });

  it('el mensaje de la página de requisitos llega a requisitos', async () => {
    const r = await says(
      'Hola, quiero terminar mi bachillerato y tengo una duda sobre los requisitos.'
    );
    expect(r.replies[0]!.body).toContain('16 años');
  });

  it('el correo ya tiene cuenta: le dice cómo entrar y no pasa a la fila', async () => {
    await says('Quiero crear mi cuenta');
    await taps('Sí, autorizo');
    await taps('Sí, 18 o más');
    await says('Laura Gómez');
    await says('laura@correo.co');
    await says('31/12/1990');
    mockCreateAccount.mockResolvedValue({ status: 'has_account' });
    const r = await taps('Sí, enviar');
    expect(r.replies.map((x) => x.body).join('\n')).toContain('/ingresar');
    expect(store.conv!.status).toBe('BOT');
  });

  it('el mismo mensaje dos veces (Meta reintenta) no se contesta otra vez', async () => {
    await says('hola', null, 'wamid.dup');
    const again = await says('hola', null, 'wamid.dup');
    expect(again.outcome).toBe('duplicate');
    expect(again.replies).toHaveLength(0);
  });

  it('cerrada que vuelve a escribir: la atiende el bot', async () => {
    await says('hola');
    store.conv!.status = 'CLOSED';
    store.conv!.assignedToId = 'staff-1';
    const r = await says('¿Cuánto dura?');
    expect(r.replies[0]!.body).toContain('6 meses');
    expect(store.conv!.status).toBe('BOT');
  });

  it('marca como leído (y «escribiendo…») cada mensaje que contesta el bot', async () => {
    await says('hola');
    expect(mockMarkRead).toHaveBeenCalledWith(expect.stringMatching(/^wamid\.in\./), 'pn-1');
  });

  it('un audio fuera del formulario: le pide escribirlo o le ofrece una persona', async () => {
    const r = await says('[audio]');
    expect(r.replies[0]!.body).toContain('no puedo escuchar audios');
    expect(r.replies[0]!.options).toEqual(['Hablar con asesor', 'Más opciones']);
  });

  it('un correo mal escrito: sugiere el bueno y lo toma con un toque', async () => {
    await says('Quiero crear mi cuenta');
    await taps('Sí, autorizo');
    await taps('Sí, 18 o más');
    expect((await says('Laura Gómez')).replies[0]!.body).toContain('Mucho gusto, Laura');
    expect((await says('laura@hotmal.com')).replies[0]!.body).toContain('laura@hotmail.com');
    const next = await taps('Sí, ese es');
    expect(next.replies[0]!.body).toContain('fecha de nacimiento');
    expect((store.conv!.intake as Record<string, string>).email).toBe('laura@hotmail.com');
    expect((await says('31 de diciembre de 1990')).replies[0]!.body).toContain('31/12/1990');
  });

  it('después del recordatorio, «Continuar» repite la pregunta donde iba', async () => {
    await says('Quiero inscribirme');
    await taps('Sí, autorizo');
    await says('Laura Gómez');
    const r = await says('Continuar', 'intake_continue');
    expect(r.replies[0]!.body).toContain('último grado');
    expect(store.conv!.intakeStep).toBe(3);
  });

  it('la encuesta al cerrar: guarda la nota, agradece y no reabre el bot', async () => {
    await says('hola');
    store.conv!.status = 'CLOSED';
    store.conv!.assignedToId = 'staff-1';
    const r = await says('😀 Muy bien', 'csat_5');
    expect(r.replies[0]!.body).toContain('Gracias por contarnos');
    expect(mockAudit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'rated',
        after: { score: 5, assignedToId: 'staff-1' },
      }),
    });
    expect(store.conv!.status).toBe('CLOSED');
  });

  it('«Reenviar correo» desde el recordatorio', async () => {
    await says('hola');
    mockResend.mockResolvedValue('sent');
    const r = await says('Reenviar correo', 'cuenta_reenviar');
    expect(r.replies[0]!.body).toContain('Te reenviamos el correo');
  });
});
