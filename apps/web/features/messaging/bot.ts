/**
 * Lo que dice el bot de WhatsApp (5/11; reescrito el 14/11 con los mensajes de Kris; 22/11 tras
 * la auditoría: bienvenida, siguiente paso en cada respuesta y más preguntas reconocidas): el
 * saludo, la respuesta a cada opción y qué preguntas escritas a mano reconoce. Puro, sin red ni
 * base: el servicio decide cuándo, esto decide qué. Solo en el chat se permiten emojis (14/11).
 */

import { ADVISOR_HOURS_TEXT, cop, type Facts } from './facts';
import { intakeStart, type IntakeKind } from './intake';

/** Las opciones del menú (la lista). */
export const CHOICES = {
  programs: 'programas',
  payments: 'pagos',
  trial: 'probar',
  enroll: 'inscribirme',
  requirements: 'requisitos',
  certificates: 'certificados',
  legal: 'legal',
  campus: 'sede',
  support: 'soporte',
  advisor: 'asesor',
} as const;

/** Respuestas que no están en la lista: se llega por botón o por lo que escribe. */
export const TOPICS = {
  welcome: 'bienvenida',
  more: 'opciones',
  duration: 'duracion',
  icfes: 'icfes',
  priceDetail: 'detalle_precio',
} as const;

const B = {
  prices: { id: CHOICES.programs, title: 'Precios y pagos' },
  trial: { id: CHOICES.trial, title: 'Crear mi cuenta' },
  enroll: { id: CHOICES.enroll, title: 'Inscribirme' },
  advisor: { id: CHOICES.advisor, title: 'Hablar con asesor' },
  more: { id: TOPICS.more, title: 'Más opciones' },
};

const OPTIONS = [
  {
    id: CHOICES.programs,
    title: 'Programa y precios',
    description: 'Bachillerato 100 % virtual: etapas, tutores y valor',
  },
  {
    id: CHOICES.payments,
    title: 'Formas de pago',
    description: 'Tarjeta, PSE, Nequi y planes de pago',
  },
  {
    id: CHOICES.trial,
    title: 'Crear mi cuenta gratis',
    description: 'Mira el programa sin compromiso',
  },
  { id: CHOICES.enroll, title: 'Inscribirme', description: 'Formaliza tu matrícula con un asesor' },
  { id: CHOICES.requirements, title: 'Requisitos', description: 'Qué necesitas para empezar' },
  {
    id: CHOICES.certificates,
    title: 'Certificados',
    description: 'Pide un certificado de estudios',
  },
  {
    id: CHOICES.legal,
    title: '¿El título es válido?',
    description: 'Instituciones aliadas y resolución',
  },
  { id: CHOICES.campus, title: '¿Cómo funciona?', description: 'Virtual, horarios y atención' },
  {
    id: CHOICES.support,
    title: 'Soporte de la plataforma',
    description: 'No puedo entrar, contraseña o exámenes',
  },
  {
    id: CHOICES.advisor,
    title: 'Hablar con un asesor',
    description: 'Te atiende una persona del equipo',
  },
];

/** El menú completo: lista interactiva (título ≤ 24, descripción ≤ 72, máximo 10 filas). */
export function menu(institutionName: string) {
  return {
    body: `Estas son todas las opciones de ${institutionName} 👇`,
    button: 'Ver opciones',
    options: OPTIONS,
  };
}

interface BotReply {
  text: string;
  /** Botones de respuesta rápida (máximo 3, título ≤ 20). */
  buttons?: Array<{ id: string; title: string }>;
  /** Lista (máximo 10 filas). */
  list?: { button: string; options: Array<{ id: string; title: string; description?: string }> };
  /** Pasa la conversación a la bandeja: espera asesor y se avisa al equipo. */
  handoff?: boolean;
  /** Empieza a pedir datos por el chat (`intake.ts`). */
  intake?: IntakeKind;
}

/** El saludo cuando escribe «hola» o algo que no se reconoce: corto y con tres caminos. */
export function greeting(institutionName: string): BotReply {
  return {
    text: `¡Hola! 👋 Soy el asistente de ${institutionName}. Te ayudo a terminar tu bachillerato 100 % virtual. ¿Qué quieres hacer?`,
    buttons: [B.prices, B.trial, B.more],
  };
}

/** Un audio, una foto o un archivo fuera de un formulario (22/11): todavía no se entienden. */
export const MEDIA_REPLY: BotReply = {
  text: 'Todavía no puedo escuchar audios ni ver fotos o archivos 🙈 ¿Me lo escribes? Si prefieres, te paso con una persona.',
  buttons: [B.advisor, B.more],
};

/** Encuesta al cerrar un chat (22/11): la respuesta llega como `csat_<1|3|5>`. */
export const CSAT = {
  ask: '¿Cómo te atendimos hoy?',
  options: [
    { id: 'csat_5', title: '😀 Muy bien' },
    { id: 'csat_3', title: '😐 Regular' },
    { id: 'csat_1', title: '😕 Mal' },
  ],
  thanks: '¡Gracias por contarnos! 🙏 Nos ayuda a atenderte mejor.',
};

/** Reenviar el correo de confirmación de la cuenta creada por el chat. */
export const RESEND_ACCOUNT = 'cuenta_reenviar';

/** La segunda vez seguida que no se entiende: una persona, mejor que otro menú. */
export const NOT_UNDERSTOOD: BotReply = {
  text: 'No te entendí bien 🙈 ¿Te comunico con una persona del equipo o prefieres ver las opciones?',
  buttons: [B.advisor, B.more],
};

/** Lo que el bot necesita saber para responder (`server/facts.service.ts` lo arma). */
export interface BotContext {
  siteUrl: string;
  policyUrl: string;
  facts: Facts;
  /** Hay cohorte de introducción: quien se registra entra a estudiar en el acto. */
  introOpen: boolean;
  /** Hay asesores ahora (`advisorsOpen`); el bot atiende siempre. */
  advisorsOpen: boolean;
}

/** La respuesta a una opción; `null` si no es una opción: vuelve el saludo. */
export function answerFor(choiceId: string | null, ctx: BotContext): BotReply | null {
  const { siteUrl, facts: f } = ctx;
  const stages = f.modules * f.modulePrice;
  switch (choiceId) {
    case TOPICS.welcome:
      return {
        text: `¡Hola! 👋 Qué bueno que quieras terminar tu bachillerato. Aquí lo haces 100 % virtual, a tu ritmo y con tutores 🎓\n\n¿Por dónde empezamos?`,
        buttons: [B.prices, B.trial, B.advisor],
      };
    case TOPICS.more:
      return {
        text: 'Estas son todas las opciones 👇',
        list: { button: 'Ver opciones', options: OPTIONS },
      };
    case CHOICES.programs:
      return {
        text: `💰 *Matrícula gratis* y pagas por etapas: ${cop(f.modulePrice)} cada una. Tu bachillerato completo, con derechos de grado: *${cop(stages + f.graduationFee)}*. Te puedes graduar en ${f.months} meses 🎓`,
        buttons: [{ id: TOPICS.priceDetail, title: 'Ver detalle' }, B.trial, B.advisor],
      };
    case TOPICS.priceDetail:
      return {
        text:
          `El detalle:\n\n• ${f.modules} etapas de ${cop(f.modulePrice)}: ${cop(stages)}\n• Derechos de grado al terminar: ${cop(f.graduationFee)}\n• Matrícula: gratis\n\n` +
          `*Total: ${cop(stages + f.graduationFee)}.* Pagas cada etapa con tarjeta, PSE o Nequi, o acuerdas un plan con un asesor.`,
        buttons: [B.trial, B.enroll, B.advisor],
      };
    case CHOICES.payments:
      return {
        text: `Pagas por etapas: cada una vale ${cop(f.modulePrice)} y la matrícula es gratis 💳\n\nTe enviamos un link de pago seguro para pagar con tarjeta, PSE o Nequi. Si necesitas un plan de pagos, lo acuerdas con un asesor.`,
        buttons: [B.enroll, B.advisor, B.more],
      };
    case CHOICES.trial:
      return { ...intakeStart('ACCOUNT', f, ctx.policyUrl), intake: 'ACCOUNT' };
    case CHOICES.enroll:
      return { ...intakeStart('ENROLL', f, ctx.policyUrl), intake: 'ENROLL' };
    case CHOICES.requirements:
      return {
        text: `Los únicos requisitos:\n\n• Tener ${f.minAge} años como mínimo\n• El certificado de estudios del último año que aprobaste\n\n¿Seguimos?`,
        buttons: [B.trial, B.enroll, B.advisor],
      };
    case CHOICES.certificates:
      return { ...intakeStart('CERTIFICATE', f, ctx.policyUrl), intake: 'CERTIFICATE' };
    case CHOICES.legal:
      return {
        text: 'Sí ✅ Las instituciones aliadas se rigen por la resolución que expide la Secretaría de Educación, y todas cuentan con ella. Al inscribirte te asignamos la institución que valida tu proceso y un asesor te comparte sus datos.',
        buttons: [B.enroll, B.advisor, B.more],
      };
    case CHOICES.campus:
      return {
        text: 'Somos 100 % virtuales 💻 Estudias desde donde estés y a la hora que quieras, y te atendemos por aquí y en la plataforma.\n\nTenemos sede administrativa, y al inscribirte te asignamos la institución que valida tu proceso: puedes pedirle certificaciones e incluso visitar sus instalaciones.',
        buttons: [B.trial, B.enroll, B.more],
      };
    case TOPICS.duration:
      return {
        text: `Depende de tu ritmo: estudias cuando quieras, las 24 horas. Si avanzas constante, puedes graduarte en ${f.months} meses 🎓`,
        buttons: [B.prices, B.trial, B.more],
      };
    case TOPICS.icfes:
      return {
        text: 'Buena pregunta 🙌 Lo del ICFES (Saber 11) depende de tu caso: un asesor te orienta.',
        buttons: [B.advisor, B.more],
      };
    case CHOICES.support:
      return {
        text: `Para entrar: ${siteUrl}/ingresar\nSi olvidaste tu contraseña: ${siteUrl}/auth/recuperar\n\nSi el problema es con un tema o un examen, usa «Reportar un problema» en esa misma pantalla.`,
        buttons: [B.advisor, B.more],
      };
    case CHOICES.advisor:
      return {
        text: ctx.advisorsOpen
          ? 'Listo 🙌 Le avisamos al equipo y un asesor te escribe por aquí lo antes posible. Mientras tanto, cuéntanos qué necesitas y en qué grado te quedaste.'
          : `Listo 🙌 Nuestros asesores atienden ${ADVISOR_HOURS_TEXT}: te dejamos en la fila y te escriben apenas abran. Cuéntanos qué necesitas; mientras tanto, yo te ayudo a cualquier hora.`,
        handoff: true,
      };
    default:
      return null;
  }
}

/** Escribió un saludo o «menú» (también el comando «/menu»): vuelve el saludo. */
export function asksForMenu(text: string): boolean {
  return /^\s*\/?(men[uú]|hola|inicio|opciones|buen[oa]s(\s+(d[ií]as|tardes|noches))?|buen\s+d[ií]a)\s*[.!?]*\s*$/i.test(
    text
  );
}

// En orden: lo más específico primero («certificado de bachillerato» es un certificado).
const INTENTS: Array<[string, RegExp]> = [
  [CHOICES.certificates, /certificad/],
  [CHOICES.requirements, /requisit|que necesito|edad|cuantos anos|tengo \d+ anos/],
  [TOPICS.icfes, /icfes|saber 11|prueba saber/],
  [CHOICES.legal, /legal|resolucion|reconocid|avalad|es valido|titulo valido/],
  [
    CHOICES.campus,
    /\bsede|direccion(?! de correo)|presencial|donde (quedan|estan)|oficina|virtual|en linea|online|horario/,
  ],
  [CHOICES.support, /no puedo (entrar|ingresar)|contrasena|clave|olvide|no me deja|no carga/],
  [CHOICES.advisor, /asesor|una persona|humano|llamar|llamen/],
  [CHOICES.enroll, /inscrib|matricul/],
  [CHOICES.trial, /probar|prueba gratis|crear (mi )?(usuario|cuenta)|registr/],
  [CHOICES.payments, /cuota|pagar|\bpago|financ|nequi|\bpse\b|tarjeta|daviplata|transferencia/],
  [TOPICS.duration, /cuanto (dura|tiempo|se demora)|duracion|en cuanto tiempo/],
  [
    TOPICS.welcome,
    /quiero (terminar|estudiar|retomar|validar|graduarme)|terminar (mi|el) bachiller|retomar|en que ciclo/,
  ],
  [
    CHOICES.programs,
    /precio|cuanto (vale|cuesta)|costo|valor|programa|informacion|\binfo\b|bachiller|validar/,
  ],
];

/** La opción que corresponde a una pregunta escrita a mano; `null` si no se reconoce. */
export function intentFor(text: string): string | null {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return INTENTS.find(([, re]) => re.test(t))?.[0] ?? null;
}
