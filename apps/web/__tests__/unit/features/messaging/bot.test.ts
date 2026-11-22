/** @jest-environment node */
/**
 * El bot de WhatsApp (5/11, 14/11): el menú cabe en los límites de WhatsApp, cada opción tiene su
 * respuesta y las preguntas escritas a mano llegan a la opción correcta. SSOT: features/messaging/bot.ts.
 */

import {
  answerFor,
  asksForMenu,
  CHOICES,
  greeting,
  intentFor,
  menu,
  TOPICS,
} from '@/features/messaging/bot';
import { DEFAULT_FACTS as FACTS } from '@/features/messaging/facts';

const SITE = 'https://alba.test';
const CTX = {
  siteUrl: SITE,
  policyUrl: `${SITE}/politica-de-datos`,
  facts: FACTS,
  introOpen: true,
  advisorsOpen: true,
};

describe('menu', () => {
  it('todas las opciones, dentro de los límites de una lista de WhatsApp', () => {
    const list = menu('ALBA Futuro Educativo');
    expect(list.options.map((o) => o.id)).toEqual(Object.values(CHOICES));
    expect(list.options.length).toBeLessThanOrEqual(10);
    for (const option of list.options) {
      expect(option.title.length).toBeLessThanOrEqual(24);
      expect(option.description.length).toBeLessThanOrEqual(72);
    }
    expect(list.button.length).toBeLessThanOrEqual(20);
    expect(list.body).toContain('ALBA Futuro Educativo');
  });
});

describe('answerFor', () => {
  it('cada opción y cada tema tienen respuesta dentro de los límites', () => {
    for (const id of [...Object.values(CHOICES), ...Object.values(TOPICS)]) {
      const reply = answerFor(id, CTX)!;
      expect(reply.text.length).toBeGreaterThan(0);
      // Un mensaje con botones admite 1024 caracteres de cuerpo.
      if (reply.buttons) {
        expect(reply.text.length).toBeLessThanOrEqual(1024);
        expect(reply.buttons.length).toBeLessThanOrEqual(3);
        for (const b of reply.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
      }
    }
  });

  it('el precio sale de los datos: con los de la plataforma cambia el total', () => {
    const facts = { ...FACTS, modules: 10, modulePrice: 95_000 };
    expect(answerFor(CHOICES.programs, { ...CTX, facts })!.text).toContain('$1.300.000');
    const { text } = answerFor(TOPICS.priceDetail, { ...CTX, facts })!;
    expect(text).toContain('10 etapas');
    expect(text).toContain('$1.300.000');
  });

  it('el precio, corto y con «Ver detalle»; el detalle trae módulos, grado y total (22/11)', () => {
    const short = answerFor(CHOICES.programs, CTX)!;
    expect(short.text.split('\n').length).toBeLessThanOrEqual(2);
    expect(short.buttons?.[0]?.id).toBe(TOPICS.priceDetail);
    const { text } = answerFor(TOPICS.priceDetail, CTX)!;
    const total = FACTS.modules * FACTS.modulePrice + FACTS.graduationFee;
    expect(text).toContain(`$${(FACTS.modules * FACTS.modulePrice).toLocaleString('es-CO')}`);
    expect(text).toContain(`$${FACTS.graduationFee.toLocaleString('es-CO')}`);
    expect(text).toContain(`$${total.toLocaleString('es-CO')}`);
  });

  it('enlaces de soporte; crear la cuenta empieza el formulario con la autorización (22/11)', () => {
    expect(answerFor(CHOICES.support, CTX)!.text).toContain(`${SITE}/auth/recuperar`);
    expect(answerFor(CHOICES.trial, CTX)!.intake).toBe('ACCOUNT');
    expect(answerFor(CHOICES.trial, CTX)!.text).toContain(`${SITE}/politica-de-datos`);
  });

  it('ninguna respuesta queda sin salida: o lleva botones, o lista, o pasa a otra cosa', () => {
    for (const id of [...Object.values(CHOICES), ...Object.values(TOPICS)]) {
      const r = answerFor(id, CTX)!;
      expect(Boolean(r.buttons?.length || r.list || r.handoff || r.intake)).toBe(true);
      expect(r.text).not.toContain('Escribe *menú*');
    }
  });

  it('el saludo: corto, con el nombre y tres caminos', () => {
    const g = greeting('ALBA Futuro Educativo');
    expect(g.text).toContain('ALBA Futuro Educativo');
    expect(g.buttons?.map((b) => b.id)).toEqual([CHOICES.programs, CHOICES.trial, TOPICS.more]);
  });

  it('fuera del horario de asesores, «asesor» dice el horario y el bot sigue (22/11)', () => {
    expect(answerFor(CHOICES.advisor, CTX)!.text).not.toContain('lunes a sábado');
    const off = answerFor(CHOICES.advisor, { ...CTX, advisorsOpen: false })!;
    expect(off.text).toContain('lunes a sábado');
    expect(off.handoff).toBe(true);
  });

  it('solo «asesor» pasa a la bandeja; inscribirme y certificados piden datos primero', () => {
    const handoff = Object.values(CHOICES).filter((id) => answerFor(id, CTX)!.handoff);
    expect(handoff).toEqual([CHOICES.advisor]);
    expect(answerFor(CHOICES.enroll, CTX)!.intake).toBe('ENROLL');
    expect(answerFor(CHOICES.trial, CTX)!.intake).toBe('ACCOUNT');
    expect(answerFor(CHOICES.certificates, CTX)!.intake).toBe('CERTIFICATE');
    // Antes de pedir datos, la autorización con la política (Ley 1581).
    expect(answerFor(CHOICES.enroll, CTX)!.text).toContain(`${SITE}/politica-de-datos`);
    expect(answerFor(CHOICES.enroll, CTX)!.buttons?.map((b) => b.id)).toEqual([
      'intake_yes',
      'intake_no',
    ]);
  });

  it('lo que no es una opción no tiene respuesta: vuelve el menú', () => {
    expect(answerFor(null, CTX)).toBeNull();
    expect(answerFor('otra', CTX)).toBeNull();
  });
});

describe('asksForMenu', () => {
  it.each([
    'menú',
    'Menu',
    'hola!',
    ' inicio ',
    'opciones',
    '/menu',
    'Buenas tardes',
    'buenos días',
  ])('«%s» pide el menú', (text) => {
    expect(asksForMenu(text)).toBe(true);
  });

  it('una pregunta cualquiera no', () => {
    expect(asksForMenu('hola, quiero saber el precio')).toBe(false);
  });
});

describe('intentFor', () => {
  it.each([
    ['Hola, quiero saber el precio', CHOICES.programs],
    ['¿Cuánto cuesta validar el bachillerato?', CHOICES.programs],
    ['Necesito un certificado de estudios', CHOICES.certificates],
    ['¿Qué requisitos piden?', CHOICES.requirements],
    ['¿Es válido el título? ¿Tienen resolución?', CHOICES.legal],
    ['¿Dónde quedan? ¿Tienen sede?', CHOICES.campus],
    ['Quiero matricularme', CHOICES.enroll],
    ['Quiero hablar con un asesor', CHOICES.advisor],
    ['¿Puedo crear mi usuario para probar?', CHOICES.trial],
    ['Ya me registré pero no puedo entrar', CHOICES.support],
    ['Olvidé mi contraseña', CHOICES.support],
    // Los ice breakers configurados en Meta (14/11) llegan como texto.
    ['¿Cuánto cuesta el bachillerato?', CHOICES.programs],
    ['Quiero probar gratis', CHOICES.trial],
    ['Necesito un certificado', CHOICES.certificates],
    // Los comandos de Meta (14/11) también llegan como texto.
    ['/precios', CHOICES.programs],
    ['/requisitos', CHOICES.requirements],
    ['/certificado', CHOICES.certificates],
    ['/asesor', CHOICES.advisor],
    ['Mi dirección de correo cambió, ¿cuánto cuesta?', CHOICES.programs],
    // 22/11: lo que se escapaba al menú.
    ['¿Puedo pagar a cuotas?', CHOICES.payments],
    ['¿Reciben Nequi?', CHOICES.payments],
    ['¿Cuánto dura?', TOPICS.duration],
    ['¿Sirve para el ICFES?', TOPICS.icfes],
    ['¿Es virtual?', CHOICES.campus],
    ['Tengo 15 años', CHOICES.requirements],
    ['Quiero crear mi cuenta', CHOICES.trial],
    // Los mensajes de los botones de la web: bienvenida, no el precio.
    ['Hola 👋 Quiero terminar mi bachillerato con ALBA Futuro Educativo.', TOPICS.welcome],
    ['Hola 👋 Quiero retomar mis estudios y terminar mi bachillerato.', TOPICS.welcome],
    ['Hola 👋 Quiero saber en qué ciclo empezaría mi bachillerato.', TOPICS.welcome],
    [
      'Hola, quiero terminar mi bachillerato y tengo una duda sobre los requisitos.',
      CHOICES.requirements,
    ],
  ])('«%s» → %s', (text, expected) => {
    expect(intentFor(text)).toBe(expected);
  });

  it('lo que no reconoce devuelve null', () => {
    expect(intentFor('gracias')).toBeNull();
  });
});
