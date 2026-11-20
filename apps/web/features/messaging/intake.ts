/**
 * Los datos que el bot pide por el chat (14/11): para inscribirse o pedir un certificado.
 * Primero la autorización de datos (Ley 1581), luego una pregunta a la vez y al final un resumen
 * para confirmar o corregir. Sin número de documento: la política de WhatsApp no deja pedirlo
 * (se pide en `/registro`). Puro: recibe la respuesta y devuelve qué guardar y qué decir.
 */

import { cop, type Facts } from './facts';

export type IntakeKind = 'ENROLL' | 'CERTIFICATE';
/** Las respuestas por clave; las que empiezan por `_` son del bot (autorización, regreso). */
export type IntakeData = Record<string, string>;

interface Field {
  key: string;
  label: string;
  ask: string;
  /** Mensaje de error, o `null` si la respuesta sirve. */
  check?: (value: string) => string | null;
}

const email = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
    ? null
    : 'Ese correo no parece válido. Escríbelo otra vez, por favor.';
const phone = (v: string) =>
  /^este$/i.test(v) || /^\+?[\d\s-]{7,15}$/.test(v)
    ? null
    : 'Escribe el número con indicativo, o *este* si es el mismo de WhatsApp.';

export const FIELDS: Record<IntakeKind, Field[]> = {
  ENROLL: [
    { key: 'fullName', label: 'Nombre completo', ask: '¿Cuál es tu nombre completo?' },
    {
      key: 'phone',
      label: 'Teléfono',
      ask: '¿Cuál es tu número de teléfono? Si es este mismo de WhatsApp, escribe *este*.',
      check: phone,
    },
    { key: 'email', label: 'Correo', ask: '¿Cuál es tu correo electrónico?', check: email },
    {
      key: 'guardian',
      label: 'Acudiente',
      ask: 'Si tienes acudiente, escribe su nombre y celular. Si no aplica, escribe *no*.',
    },
  ],
  CERTIFICATE: [
    { key: 'fullName', label: 'Nombre completo', ask: '¿Cuál es tu nombre completo?' },
    {
      key: 'documentPlace',
      label: 'Lugar de expedición',
      ask: '¿En qué lugar se expidió tu documento de identidad?',
    },
    { key: 'reason', label: 'Motivo', ask: '¿Para qué necesitas el certificado?' },
  ],
};

/** Lo que el bot dice: texto, y a veces botones o una lista para elegir. */
export interface IntakeReply {
  text: string;
  buttons?: Array<{ id: string; title: string }>;
  list?: { button: string; options: Array<{ id: string; title: string }> };
}

export interface IntakeContext {
  waId: string;
  now: Date;
  policyUrl: string;
}

// Los pasos: 0 la autorización, 1…n las preguntas, n+1 el resumen, n+2 elegir qué corregir.
const CONSENT = 0;
const confirmStep = (kind: IntakeKind) => FIELDS[kind].length + 1;
const fixStep = (kind: IntakeKind) => FIELDS[kind].length + 2;

const YES = 'intake_yes';
const NO = 'intake_no';
const FIX = 'intake_fix';
const FIELD = 'intake_field_';

/** Los botones del formulario llegan como `choiceId` y no deben sacarlo de él. */
export const isIntakeChoice = (choiceId: string | null) => !!choiceId?.startsWith('intake_');

const said = (text: string, re: RegExp) => re.test(text.trim().toLowerCase());
const SAYS_YES = /^(s[ií]|si,? autorizo|autorizo|acepto|de acuerdo|ok|listo|s[ií],? enviar)[.!]*$/;
const SAYS_NO = /^(no|no autorizo|no acepto)[.!]*$/;
const SAYS_FIX = /^corregir[.!]*$/;

/** Lo primero: para qué son los datos y la autorización. */
export function intakeStart(kind: IntakeKind, facts: Facts, policyUrl: string): IntakeReply {
  const intro =
    kind === 'ENROLL'
      ? '¡Qué bien! 🙌 Para formalizar tu matrícula te pido unos datos, uno a la vez.'
      : `Claro que sí 📄 Los certificados tienen un costo de ${cop(facts.certificatePrice)} y, después del pago, te lo enviamos en un plazo máximo de ${facts.certificateBusinessDays} días hábiles. Te pido unos datos, uno a la vez.`;
  return consent(intro, kind, policyUrl);
}

function consent(intro: string, kind: IntakeKind, policyUrl: string): IntakeReply {
  const purpose = kind === 'ENROLL' ? 'tu matrícula' : 'tu certificado';
  return {
    text: `${intro}\n\n🔒 Usaremos tus datos solo para gestionar ${purpose}, según nuestra política de tratamiento de datos: ${policyUrl}\n\n¿Autorizas el tratamiento de tus datos? Puedes escribir *cancelar* cuando quieras.`,
    buttons: [
      { id: YES, title: 'Sí, autorizo' },
      { id: NO, title: 'No' },
    ],
  };
}

export type IntakeStep =
  | { status: 'retry'; reply: IntakeReply }
  | { status: 'next'; data: IntakeData; step: number; reply: IntakeReply }
  | { status: 'done'; data: IntakeData; reply: IntakeReply }
  | { status: 'cancel'; reply: IntakeReply };

/** Responde al paso `step` con lo que escribió o eligió. */
export function intakeAnswer(
  kind: IntakeKind,
  step: number,
  data: IntakeData,
  input: { text: string; choiceId: string | null },
  ctx: IntakeContext
): IntakeStep {
  const fields = FIELDS[kind];
  const text = input.text.trim();
  const choice = input.choiceId;

  if (step === CONSENT) {
    if (choice === YES || said(text, SAYS_YES)) {
      const next = { ...data, _consentAt: ctx.now.toISOString(), _policy: ctx.policyUrl };
      return { status: 'next', data: next, step: 1, reply: { text: fields[0]!.ask } };
    }
    if (choice === NO || said(text, SAYS_NO)) {
      return {
        status: 'cancel',
        reply: {
          text: 'Entendido, no guardamos ningún dato 👍 Si quieres, elige «Hablar con un asesor» o escribe *menú* para ver las opciones.',
        },
      };
    }
    return {
      status: 'retry',
      reply: consent('Para seguir necesito tu respuesta.', kind, ctx.policyUrl),
    };
  }

  if (step === confirmStep(kind)) {
    if (choice === YES || said(text, SAYS_YES)) {
      return { status: 'done', data, reply: { text: doneText(kind) } };
    }
    if (choice === FIX || said(text, SAYS_FIX)) {
      return { status: 'next', data, step: fixStep(kind), reply: fixList(kind) };
    }
    return { status: 'retry', reply: confirmReply(kind, data) };
  }

  if (step === fixStep(kind)) {
    const index = fields.findIndex((f) => choice === `${FIELD}${f.key}`);
    if (index === -1) return { status: 'retry', reply: fixList(kind) };
    return {
      status: 'next',
      data: { ...data, _back: 'confirm' },
      step: index + 1,
      reply: { text: fields[index]!.ask },
    };
  }

  const field = fields[step - 1];
  if (!field) return { status: 'retry', reply: confirmReply(kind, data) };

  // «corregir» en medio de las preguntas vuelve a la anterior.
  if (said(text, SAYS_FIX)) {
    const back = Math.max(1, step - 1);
    return { status: 'next', data, step: back, reply: { text: fields[back - 1]!.ask } };
  }
  // Una foto o un audio llegan como «[image]»: aquí se pide texto.
  if (!text || /^\[\w+\]$/.test(text)) {
    return { status: 'retry', reply: { text: `Escríbelo como texto, por favor.\n\n${field.ask}` } };
  }
  const value = text.slice(0, 200);
  const error = field.check?.(value) ?? null;
  if (error) return { status: 'retry', reply: { text: `${error}\n\n${field.ask}` } };

  const stored =
    field.key === 'phone' && /^este$/i.test(value)
      ? `+${ctx.waId}`
      : field.key === 'guardian' && /^no\.?$/i.test(value)
        ? 'No aplica'
        : value;
  const { _back, ...rest } = { ...data, [field.key]: stored };
  const following = fields[step];
  if (_back === 'confirm' || !following) {
    return { status: 'next', data: rest, step: confirmStep(kind), reply: confirmReply(kind, rest) };
  }
  return { status: 'next', data: rest, step: step + 1, reply: { text: following.ask } };
}

function confirmReply(kind: IntakeKind, data: IntakeData): IntakeReply {
  const lines = intakeSummary(kind, data)
    .map(({ label, value }) => `• ${label}: ${value}`)
    .join('\n');
  return {
    text: `Revisa tus datos:\n\n${lines}\n\n¿Está todo bien?`,
    buttons: [
      { id: YES, title: 'Sí, enviar' },
      { id: FIX, title: 'Corregir' },
    ],
  };
}

function fixList(kind: IntakeKind): IntakeReply {
  return {
    text: '¿Qué dato quieres corregir?',
    list: {
      button: 'Elegir dato',
      options: FIELDS[kind].map((f) => ({ id: `${FIELD}${f.key}`, title: f.label })),
    },
  };
}

function doneText(kind: IntakeKind): string {
  return kind === 'ENROLL'
    ? '¡Gracias! ✅ Recibimos tus datos. Un asesor los revisa y te escribe por aquí. La matrícula queda formalizada al pagar el primer módulo.'
    : '¡Gracias! ✅ Recibimos tu solicitud. Un asesor te confirma y te envía cómo pagar.';
}

/** Los datos con su etiqueta, en el orden en que se piden (para el chat y para la bandeja). */
export function intakeSummary(kind: IntakeKind, data: IntakeData) {
  return FIELDS[kind]
    .filter((f) => data[f.key])
    .map((f) => ({ label: f.label, value: data[f.key]! }));
}

/** Quiere salir del formulario. */
export function cancelsIntake(text: string): boolean {
  return /^\s*(cancelar|salir)\s*[.!]*\s*$/i.test(text);
}
