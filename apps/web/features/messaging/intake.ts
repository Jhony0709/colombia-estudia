/**
 * Los datos que el bot pide por el chat (14/11; 22/11: crear la cuenta y menos fricción): para
 * inscribirse, pedir un certificado o crear la cuenta. Primero la autorización de datos (Ley
 * 1581), luego una pregunta a la vez —con botones o lista cuando hay opciones— y al final un
 * resumen para confirmar o corregir. Sin número de documento: la política de WhatsApp no deja
 * pedirlo (se completa en la plataforma). Puro: recibe la respuesta y devuelve qué guardar y qué
 * decir.
 */

import { calculateAgeAt } from '@colombia-estudia/domain';
import { cop, type Facts } from './facts';

export type IntakeKind = 'ENROLL' | 'CERTIFICATE' | 'ACCOUNT';
/** Las respuestas por clave; las que empiezan por `_` son del bot (autorización, regreso). */
export type IntakeData = Record<string, string>;

export interface IntakeContext {
  waId: string;
  now: Date;
  policyUrl: string;
  siteUrl?: string;
}

interface Option {
  id: string;
  title: string;
}

interface Field {
  key: string;
  label: string;
  ask: string;
  /** Mensaje de error, o `null` si la respuesta sirve. */
  check?: (value: string, ctx: IntakeContext) => string | null;
  /** Para elegir: hasta 3 van en botones; más, en lista. */
  options?: string[];
  /** Solo valen sus opciones; si no, también lo escrito a mano. */
  strict?: boolean;
  /** No se pregunta con lo que ya respondió. */
  skip?: (data: IntakeData) => boolean;
  /** No se pregunta: lo llena el bot y se puede corregir en el resumen. */
  auto?: (ctx: IntakeContext) => string;
  /** Detiene el formulario sin guardar nada; devuelve qué decir. */
  stop?: (value: string, ctx: IntakeContext) => string | null;
}

const email = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
    ? null
    : 'Ese correo no parece válido. Escríbelo otra vez, por favor.';
const phone = (v: string) =>
  /^\+?[\d\s-]{7,15}$/.test(v)
    ? null
    : 'Escribe el número con indicativo, por ejemplo +57 300 123 4567.';
const twoWords = (v: string) =>
  v.trim().split(/\s+/).length >= 2 ? null : 'Escribe tu nombre y tu apellido, por favor.';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/** «dic», «sept», «diciembre» → 12; «setiembre» también es 9. */
const monthOf = (word: string) =>
  word === 'set' || 'setiembre'.startsWith(word)
    ? 9
    : MONTHS.findIndex((m) => m.startsWith(word)) + 1 || undefined;

/** Año de dos cifras: `90` es 1990 y `05` es 2005. */
const fullYear = (y: string) =>
  y.length === 4 ? Number(y) : Number(y) + (Number(y) <= 30 ? 2000 : 1900);

/**
 * La fecha como la escriba (22/11): `31/12/1990`, `31-12-90`, `31 de diciembre de 1990` o
 * `31 dic 1990` (o `1990-12-31`), a `YYYY-MM-DD`; `null` si no es una fecha real.
 */
export function parseBirthDate(text: string): string | null {
  const t = fold(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t);
  const named = /^(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\.?\s*(?:del?\s+)?(\d{4}|\d{2})$/.exec(t);
  const month = named ? monthOf(named[2]!) : undefined;
  const parts = iso
    ? [iso[3]!, iso[2]!, iso[1]!]
    : numeric
      ? [numeric[1]!, numeric[2]!, numeric[3]!]
      : named && month
        ? [named[1]!, String(month), named[3]!]
        : null;
  if (!parts) return null;
  const [d, mo, y] = [Number(parts[0]), Number(parts[1]), fullYear(parts[2]!)];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

const KNOWN_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'live.com',
];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

/** `laura@gmial.com` → `laura@gmail.com` (22/11); `null` si el dominio está bien o no se parece. */
export function suggestEmail(value: string): string | null {
  const at = value.lastIndexOf('@');
  if (at < 1) return null;
  const domain = value.slice(at + 1).toLowerCase();
  if (KNOWN_DOMAINS.includes(domain)) return null;
  const [best, d] = KNOWN_DOMAINS.map((k) => [k, distance(domain, k)] as const).sort(
    (a, b) => a[1] - b[1]
  )[0]!;
  return d <= 2 ? `${value.slice(0, at)}@${best}` : null;
}

const ADULT = ['Sí, 18 o más', 'No, soy menor'];
// El acudiente solo se pregunta cuando ya dijo que es menor: así el «1 de 4» no cambia.
const notMinor = (data: IntakeData) => data.adult !== ADULT[1];
const minorStop = (ctx: IntakeContext) =>
  `Gracias 🙏 Como eres menor de edad, tu cuenta se crea con tu acudiente en ${ctx.siteUrl ?? ''}/registro: ahí pueden hacerlo juntos. Borramos de este chat los datos que nos diste.`;

/** Al salir del formulario, una salida: una persona o las opciones (ids de `bot.ts`). */
const EXITS: Option[] = [
  { id: 'asesor', title: 'Hablar con asesor' },
  { id: 'opciones', title: 'Más opciones' },
];

const PHONE: Field = {
  key: 'phone',
  label: 'Teléfono',
  ask: '¿A qué número te escribimos? Escríbelo con indicativo.',
  check: phone,
  auto: (ctx) => `+${ctx.waId}`,
};

export const FIELDS: Record<IntakeKind, Field[]> = {
  ENROLL: [
    { key: 'fullName', label: 'Nombre completo', ask: '¿Cuál es tu nombre completo?' },
    PHONE,
    {
      key: 'grade',
      label: 'Último grado aprobado',
      ask: '¿Cuál fue el último grado que aprobaste?',
      options: ['5° o menos', '6°', '7°', '8°', '9°', '10°', '11° sin graduarme'],
    },
    {
      key: 'adult',
      label: 'Mayor de edad',
      ask: '¿Eres mayor de edad?',
      options: ADULT,
      strict: true,
    },
    {
      key: 'guardian',
      label: 'Acudiente',
      ask: 'Como eres menor de edad, escribe el nombre y el celular de tu acudiente.',
      skip: notMinor,
    },
    { key: 'email', label: 'Correo', ask: '¿Cuál es tu correo electrónico?', check: email },
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
  ACCOUNT: [
    {
      key: 'adult',
      label: 'Mayor de edad',
      ask: 'Primero: ¿eres mayor de edad?',
      options: ADULT,
      strict: true,
      stop: (v, ctx) => (v === ADULT[1] ? minorStop(ctx) : null),
    },
    {
      key: 'fullName',
      label: 'Nombre y apellido',
      ask: '¿Cuál es tu nombre y tu apellido?',
      check: twoWords,
    },
    {
      key: 'email',
      label: 'Correo',
      ask: '¿Cuál es tu correo electrónico? Ahí te llega el enlace para confirmarlo.',
      check: email,
    },
    {
      key: 'birthDate',
      label: 'Fecha de nacimiento',
      ask: '¿Cuál es tu fecha de nacimiento? Escríbela así: 31/12/1990.',
      check: (v, ctx) => {
        const iso = parseBirthDate(v);
        if (!iso || new Date(iso) > ctx.now)
          return 'Esa fecha no es válida. Escríbela así: 31/12/1990.';
        return null;
      },
      stop: (v, ctx) => {
        const iso = parseBirthDate(v);
        return iso && calculateAgeAt(new Date(`${iso}T00:00:00Z`), ctx.now) < 18
          ? minorStop(ctx)
          : null;
      },
    },
    PHONE,
  ],
};

/** Lo que el bot dice: texto, y a veces botones o una lista para elegir. */
export interface IntakeReply {
  text: string;
  buttons?: Option[];
  list?: { button: string; options: Option[] };
}

// Los pasos: 0 la autorización, 1…n las preguntas, n+1 el resumen, n+2 elegir qué corregir.
const CONSENT = 0;
const confirmStep = (kind: IntakeKind) => FIELDS[kind].length + 1;
const fixStep = (kind: IntakeKind) => FIELDS[kind].length + 2;

const YES = 'intake_yes';
const NO = 'intake_no';
/** Los botones del recordatorio de un formulario a medias (`nudges.service.ts`, 22/11). */
export const CONTINUE = 'intake_continue';
export const STOP = 'intake_cancel';
const SUGGEST_YES = 'intake_sugg_yes';
const SUGGEST_NO = 'intake_sugg_no';
const FIX = 'intake_fix';
const FIELD = 'intake_field_';
const OPT = 'intake_opt_';

/** Los botones del formulario llegan como `choiceId` y no deben sacarlo de él. */
export const isIntakeChoice = (choiceId: string | null) => !!choiceId?.startsWith('intake_');

const fold = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const said = (text: string, re: RegExp) => re.test(text.trim().toLowerCase());
const SAYS_YES = /^(s[ií]|si,? autorizo|autorizo|acepto|de acuerdo|ok|listo|s[ií],? enviar)[.!]*$/;
const SAYS_NO = /^(no|no autorizo|no acepto)[.!]*$/;
const SAYS_FIX = /^corregir[.!]*$/;

const PURPOSE: Record<IntakeKind, string> = {
  ENROLL: 'tu matrícula',
  CERTIFICATE: 'tu certificado',
  ACCOUNT: 'crear tu cuenta en la plataforma',
};

/** Lo primero: para qué son los datos y la autorización. */
export function intakeStart(kind: IntakeKind, facts: Facts, policyUrl: string): IntakeReply {
  const intro =
    kind === 'ENROLL'
      ? '¡Qué bien! 🙌 Para formalizar tu matrícula te pido unos datos, uno a la vez.'
      : kind === 'ACCOUNT'
        ? '¡Genial! 🙌 Creamos tu cuenta por aquí en un minuto. Te pido unos datos, uno a la vez, y al final te llega un correo para confirmarlo y crear tu contraseña.'
        : `Claro que sí 📄 Los certificados tienen un costo de ${cop(facts.certificatePrice)} y, después del pago, te lo enviamos en un plazo máximo de ${facts.certificateBusinessDays} días hábiles. Te pido unos datos, uno a la vez.`;
  return consent(intro, kind, policyUrl);
}

function consent(intro: string, kind: IntakeKind, policyUrl: string): IntakeReply {
  return {
    text: `${intro}\n\n🔒 Usaremos tus datos solo para ${PURPOSE[kind]}, según nuestra política de tratamiento de datos: ${policyUrl}\n\n¿Autorizas el tratamiento de tus datos? Puedes escribir *cancelar* cuando quieras.`,
    buttons: [
      { id: YES, title: 'Sí, autorizo' },
      { id: NO, title: 'No' },
    ],
  };
}

/** La pregunta de un dato, con sus opciones si las tiene. */
function askReply(field: Field, prefix = '', progress = ''): IntakeReply {
  const ask = progress ? `*${progress}* · ${field.ask}` : field.ask;
  const text = prefix ? `${prefix}\n\n${ask}` : ask;
  if (!field.options) return { text };
  const options = field.options.map((title, i) => ({ id: `${OPT}${field.key}_${i}`, title }));
  return options.length <= 3
    ? { text, buttons: options }
    : { text, list: { button: 'Elegir', options } };
}

const askable = (f: Field, data: IntakeData) => !f.auto && !f.skip?.(data);

/** El siguiente paso que se pregunta después de `step` (1…n), o el resumen. */
function nextStep(kind: IntakeKind, step: number, data: IntakeData): number {
  const fields = FIELDS[kind];
  for (let i = step; i < fields.length; i++) if (askable(fields[i]!, data)) return i + 1;
  return confirmStep(kind);
}

/** «2 de 4»: el lugar de este paso entre los que se preguntan con lo que ya hay. */
function progressOf(kind: IntakeKind, step: number, data: IntakeData): string {
  const asked = FIELDS[kind].map((f, i) => (askable(f, data) ? i + 1 : 0)).filter(Boolean);
  const at = asked.indexOf(step);
  return at === -1 ? '' : `${at + 1} de ${asked.length}`;
}

/** Cuántas preguntas le faltan desde este paso. */
export function remaining(kind: IntakeKind, step: number, data: IntakeData): number {
  return FIELDS[kind].filter((f, i) => i + 1 >= step && askable(f, data)).length;
}

function previousStep(kind: IntakeKind, step: number, data: IntakeData): number {
  const fields = FIELDS[kind];
  for (let i = step - 2; i >= 0; i--) if (askable(fields[i]!, data)) return i + 1;
  return nextStep(kind, 0, data);
}

/** Lo que eligió o escribió, como valor; `null` si un campo estricto no lo reconoce. */
function valueOf(field: Field, text: string, choice: string | null): string | null {
  if (field.options) {
    const prefix = `${OPT}${field.key}_`;
    if (choice?.startsWith(prefix))
      return field.options[Number(choice.slice(prefix.length))] ?? null;
    const typed = fold(text);
    const hit = typed ? field.options.find((o) => fold(o).startsWith(typed)) : undefined;
    if (hit) return hit;
    if (field.strict) return null;
  }
  return text.slice(0, 200);
}

export type IntakeStep =
  | { status: 'retry'; reply: IntakeReply }
  | { status: 'next'; data: IntakeData; step: number; reply: IntakeReply }
  | { status: 'done'; data: IntakeData; reply: IntakeReply }
  /** `forget`: borrar del hilo lo que escribió desde la autorización (un menor, 22/11). */
  | { status: 'cancel'; reply: IntakeReply; forget?: boolean };

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
  const ask = (at: number, d: IntakeData, prefix = ''): IntakeReply =>
    at === confirmStep(kind)
      ? confirmReply(kind, d)
      : askReply(fields[at - 1]!, prefix, progressOf(kind, at, d));

  // Desde el recordatorio: «Continuar» repite donde iba; «Cancelar» sale.
  if (choice === STOP) {
    return {
      status: 'cancel',
      reply: { text: 'Listo, lo dejamos aquí 👍 ¿Te ayudo con algo más?', buttons: EXITS },
    };
  }
  if (choice === CONTINUE) {
    const reply =
      step === CONSENT
        ? consent('¡Sigamos! 🙌', kind, ctx.policyUrl)
        : step === fixStep(kind)
          ? fixList(kind, data)
          : ask(step, data);
    return { status: 'retry', reply };
  }

  if (step === CONSENT) {
    if (choice === YES || said(text, SAYS_YES)) {
      const filled = Object.fromEntries(
        fields.flatMap((f) => (f.auto ? [[f.key, f.auto(ctx)]] : []))
      );
      const next = {
        ...data,
        ...filled,
        _consentAt: ctx.now.toISOString(),
        _policy: ctx.policyUrl,
      };
      const first = nextStep(kind, 0, next);
      return { status: 'next', data: next, step: first, reply: ask(first, next) };
    }
    if (choice === NO || said(text, SAYS_NO)) {
      return {
        status: 'cancel',
        reply: {
          text: 'Entendido, no te pedimos ningún dato 👍 ¿Te ayudo con algo más?',
          buttons: EXITS,
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
      return { status: 'next', data, step: fixStep(kind), reply: fixList(kind, data) };
    }
    return { status: 'retry', reply: confirmReply(kind, data) };
  }

  if (step === fixStep(kind)) {
    const index = fields.findIndex((f) => choice === `${FIELD}${f.key}`);
    if (index === -1) return { status: 'retry', reply: fixList(kind, data) };
    return {
      status: 'next',
      data: { ...data, _back: 'confirm' },
      step: index + 1,
      reply: askReply(fields[index]!),
    };
  }

  const field = fields[step - 1];
  if (!field) return { status: 'retry', reply: confirmReply(kind, data) };

  // «corregir» en medio de las preguntas vuelve a la anterior.
  if (said(text, SAYS_FIX)) {
    const back = previousStep(kind, step, data);
    return { status: 'next', data, step: back, reply: ask(back, data) };
  }
  const progress = progressOf(kind, step, data);
  // Una foto o un audio llegan como «[image]»: aquí se pide texto.
  if ((!text && !choice) || /^\[\w+\]$/.test(text)) {
    return {
      status: 'retry',
      reply: askReply(field, 'Escríbelo como texto, por favor.', progress),
    };
  }

  // La sugerencia de correo pendiente (22/11): «sí» la toma, «no» deja lo que escribió.
  const { _emailTyped, _emailSuggestion, ...clean } = data;
  let current = data;
  if (field.key === 'email' && _emailSuggestion) {
    const pick =
      choice === SUGGEST_YES || said(text, SAYS_YES)
        ? _emailSuggestion
        : choice === SUGGEST_NO || said(text, SAYS_NO)
          ? (_emailTyped ?? '')
          : null;
    if (pick) return store(kind, step, clean, field, pick, ctx);
    current = clean;
  }

  const value = valueOf(field, text, choice);
  if (value === null) {
    return { status: 'retry', reply: askReply(field, 'Elige una de las opciones.', progress) };
  }
  const error = field.check?.(value, ctx) ?? null;
  if (error) return { status: 'retry', reply: askReply(field, error, progress) };
  const suggestion = field.key === 'email' ? suggestEmail(value) : null;
  if (suggestion) {
    return {
      status: 'next',
      data: { ...current, _emailTyped: value, _emailSuggestion: suggestion },
      step,
      reply: {
        text: `¿Quisiste decir *${suggestion}*?`,
        buttons: [
          { id: SUGGEST_YES, title: 'Sí, ese es' },
          { id: SUGGEST_NO, title: 'No, está bien' },
        ],
      },
    };
  }
  return store(kind, step, current, field, value, ctx);
}

/** Guarda la respuesta válida y pasa a la siguiente pregunta (o vuelve al resumen). */
function store(
  kind: IntakeKind,
  step: number,
  data: IntakeData,
  field: Field,
  value: string,
  ctx: IntakeContext
): IntakeStep {
  const fields = FIELDS[kind];
  const stop = field.stop?.(value, ctx) ?? null;
  if (stop) return { status: 'cancel', reply: { text: stop, buttons: EXITS }, forget: true };

  const stored =
    field.key === 'guardian' && /^no\.?$/i.test(value)
      ? 'No aplica'
      : field.key === 'birthDate'
        ? (parseBirthDate(value) ?? value)
        : value;
  const { _back, ...rest } = { ...data, [field.key]: stored };
  const following = nextStep(kind, step, rest);
  // Al saber su nombre, se lo devuelve: se siente menos formulario.
  const greet = field.key === 'fullName' ? `Mucho gusto, ${stored.split(/\s+/)[0]} 👋` : '';
  if (_back === 'confirm') {
    // Al corregir, si el cambio abre una pregunta nueva (menor → acudiente), se hace antes.
    const pending = fields.findIndex((f, i) => i >= step && askable(f, rest) && !rest[f.key]);
    if (pending !== -1) {
      return {
        status: 'next',
        data: { ...rest, _back: 'confirm' },
        step: pending + 1,
        reply: askReply(fields[pending]!),
      };
    }
    return { status: 'next', data: rest, step: confirmStep(kind), reply: confirmReply(kind, rest) };
  }
  return {
    status: 'next',
    data: rest,
    step: following,
    reply:
      following === confirmStep(kind)
        ? confirmReply(kind, rest)
        : askReply(fields[following - 1]!, greet, progressOf(kind, following, rest)),
  };
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

function fixList(kind: IntakeKind, data: IntakeData): IntakeReply {
  return {
    text: '¿Qué dato quieres corregir?',
    list: {
      button: 'Elegir dato',
      options: FIELDS[kind]
        .filter((f) => !f.skip?.(data) && !(kind === 'ACCOUNT' && f.key === 'adult'))
        .map((f) => ({ id: `${FIELD}${f.key}`, title: f.label })),
    },
  };
}

function doneText(kind: IntakeKind): string {
  if (kind === 'ACCOUNT') return 'Perfecto, estoy creando tu cuenta… ⏳';
  return kind === 'ENROLL'
    ? '¡Gracias! ✅ Recibimos tus datos. Un asesor los revisa y te escribe por aquí. La matrícula queda formalizada al pagar la primera etapa.'
    : '¡Gracias! ✅ Recibimos tu solicitud. Un asesor te confirma y te envía cómo pagar.';
}

/** Los datos con su etiqueta, en el orden en que se piden (para el chat y para la bandeja). */
export function intakeSummary(kind: IntakeKind, data: IntakeData) {
  return FIELDS[kind]
    .filter((f) => data[f.key] && !f.skip?.(data))
    .map((f) => ({
      label: f.label,
      value: f.key === 'birthDate' ? data[f.key]!.split('-').reverse().join('/') : data[f.key]!,
    }));
}

/** Quiere salir del formulario. */
export function cancelsIntake(text: string): boolean {
  return /^\s*(cancelar|salir)\s*[.!]*\s*$/i.test(text);
}
