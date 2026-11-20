/**
 * Lo que dice el bot de WhatsApp (5/11; reescrito el 14/11 con los mensajes de Kris): el saludo
 * con el menú, la respuesta a cada opción y qué preguntas escritas a mano reconoce. Puro, sin red
 * ni base: el servicio decide cuándo, esto decide qué. Solo en el chat se permiten emojis (14/11).
 */

import { cop, type Facts } from './facts';
import { intakeStart, type IntakeKind } from './intake';

export const CHOICES = {
  programs: 'programas',
  trial: 'probar',
  enroll: 'inscribirme',
  requirements: 'requisitos',
  certificates: 'certificados',
  legal: 'legal',
  campus: 'sede',
  support: 'soporte',
  advisor: 'asesor',
} as const;

/** El saludo: lista interactiva (título ≤ 24 caracteres, descripción ≤ 72, máximo 10 filas). */
export function menu(institutionName: string) {
  return {
    body: `¡Hola! 👋 Soy el asistente de ${institutionName}. ¿En qué te ayudamos?`,
    button: 'Ver opciones',
    options: [
      {
        id: CHOICES.programs,
        title: 'Programa y precios',
        description: 'Bachillerato 100 % virtual: módulos, tutores y valor',
      },
      {
        id: CHOICES.trial,
        title: 'Probar gratis',
        description: 'Crea tu usuario y mira el programa sin compromiso',
      },
      {
        id: CHOICES.enroll,
        title: 'Inscribirme',
        description: 'Formaliza tu matrícula con un asesor',
      },
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
      { id: CHOICES.campus, title: '¿Tienen sede?', description: 'Cómo funciona la atención' },
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
    ],
  };
}

interface BotReply {
  text: string;
  /** Botones de respuesta rápida (máximo 3, título ≤ 20). */
  buttons?: Array<{ id: string; title: string }>;
  /** Pasa la conversación a la bandeja: espera asesor y se avisa al equipo. */
  handoff?: boolean;
  /** Empieza a pedir datos por el chat (`intake.ts`). */
  intake?: IntakeKind;
}

const AGAIN = 'Escribe *menú* para ver las opciones otra vez.';

/** Lo que el bot necesita saber para responder (`server/facts.service.ts` lo arma). */
export interface BotContext {
  siteUrl: string;
  policyUrl: string;
  facts: Facts;
  /** Hay cohorte de introducción: quien se registra entra a estudiar en el acto. */
  introOpen: boolean;
}

/** La respuesta a una opción; `null` si no es una opción: vuelve el menú. */
export function answerFor(choiceId: string | null, ctx: BotContext): BotReply | null {
  const { siteUrl, facts: f } = ctx;
  const graduation = f.graduation ?? 'por definir';
  switch (choiceId) {
    case CHOICES.programs:
      return {
        text:
          `Nuestro bachillerato 100 % virtual tiene ${f.modules} módulos de contenido: te conectas las 24 horas a tu usuario para estudiar y tienes acceso a tutores personalizados. Sé bachiller en ${f.months} meses 🎓\n\n` +
          `💰 *Matrícula gratis.* Pagas los módulos de contenido: cada uno vale ${cop(f.modulePrice)}, ${cop(f.modules * f.modulePrice)} por todo el material de estudio. Al finalizar pagas ${cop(f.graduationFee)} de derechos de grado.\n\n` +
          `*Tu bachillerato por un total de ${cop(f.modules * f.modulePrice + f.graduationFee)}.*`,
        buttons: [
          { id: CHOICES.trial, title: 'Probar gratis' },
          { id: CHOICES.enroll, title: 'Inscribirme' },
          { id: CHOICES.advisor, title: 'Hablar con asesor' },
        ],
      };
    case CHOICES.trial:
      return {
        text:
          `Puedes crear tu usuario y navegar el programa: ya hay material de estudio disponible. No pagas nada ni adquieres ningún compromiso, y solo te pedimos los datos necesarios para crear la cuenta 🙌\n\n👉 ${siteUrl}/registro\n\n` +
          `${ctx.introOpen ? 'Al crearla entras al módulo de introducción.' : 'Al crearla, un asesor te habilita el módulo de introducción.'} Si te convence, formalizas la matrícula pagando el primer módulo. Fecha de grado: ${graduation}.\n\n${AGAIN}`,
      };
    case CHOICES.enroll:
      return { ...intakeStart('ENROLL', f, ctx.policyUrl), intake: 'ENROLL' };
    case CHOICES.requirements:
      return {
        text: `Únicos requisitos:\n\n• Tener ${f.minAge} años como mínimo\n• Presentar el certificado de estudios del último año aprobado\n\nSi tienes alguna otra inquietud, elige «Hablar con un asesor». ${AGAIN}`,
      };
    case CHOICES.certificates:
      return { ...intakeStart('CERTIFICATE', f, ctx.policyUrl), intake: 'CERTIFICATE' };
    case CHOICES.legal:
      return {
        text: `Las instituciones se rigen por la resolución que expide la Secretaría de Educación, y todas cuentan con ese número ✅ Tenemos varias instituciones aliadas: al generar tu inscripción te asignamos la que valida tu proceso formativo.\n\n${AGAIN}`,
      };
    case CHOICES.campus:
      return {
        text: `No contamos con una sede física de atención, solo la administrativa: toda nuestra operación es 100 % virtual 💻\n\nAl generar tu inscripción y asignarte la institución que valida tu proceso, podrás pedir certificaciones e incluso visitar sus instalaciones para verificar la credibilidad del proceso.\n\n${AGAIN}`,
      };
    case CHOICES.support:
      return {
        text: `Para entrar: ${siteUrl}/ingresar\nSi olvidaste tu contraseña: ${siteUrl}/auth/recuperar\n\nSi el problema es con un tema o un examen, usa «Reportar un problema» en esa misma pantalla. Si sigue sin funcionar, elige «Hablar con un asesor». ${AGAIN}`,
      };
    case CHOICES.advisor:
      return {
        text: 'Listo. Le avisamos al equipo y un asesor te escribe por aquí en unos minutos. Puedes ir contándonos qué necesitas.',
        handoff: true,
      };
    default:
      return null;
  }
}

/** Escribió «menú» (o «menu», «hola», «inicio», o el comando «/menu»): vuelve el saludo. */
export function asksForMenu(text: string): boolean {
  return /^\s*\/?(men[uú]|hola|inicio|opciones)\s*[.!?]*\s*$/i.test(text);
}

// En orden: lo más específico primero («certificado de bachillerato» es un certificado).
const INTENTS: Array<[string, RegExp]> = [
  [CHOICES.certificates, /certificad/],
  [CHOICES.requirements, /requisit|que necesito|edad|cuantos anos/],
  [CHOICES.legal, /legal|resolucion|reconocid|avalad|es valido|titulo valido/],
  [CHOICES.campus, /\bsede|direccion(?! de correo)|presencial|donde (quedan|estan)|oficina/],
  [CHOICES.support, /no puedo (entrar|ingresar)|contrasena|clave|olvide|no me deja|no carga/],
  [CHOICES.advisor, /asesor|una persona|humano|llamar|llamen/],
  [CHOICES.enroll, /inscrib|matricul/],
  [CHOICES.trial, /probar|prueba gratis|crear (mi )?usuario|registr/],
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
