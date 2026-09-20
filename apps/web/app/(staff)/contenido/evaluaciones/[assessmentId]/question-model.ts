/**
 * El modelo de una evaluación mientras se edita.
 * SSOT: packages/types/src/content.ts (`AssessmentContentSchema`, `AnswerKeySchema`).
 *
 * Lo que la pantalla manipula son objetos, no texto: hasta el 18/9 el editor era un
 * `textarea` donde había que escribir el JSON a mano —código, tipo, enunciado, puntos y
 * opciones, con sus llaves y sus comas— y un `}` de más dejaba el guardado en silencio. Para
 * un equipo de operación no técnico eso no es una pantalla difícil, es una pantalla que no se
 * puede usar.
 *
 * Los códigos (`p1`, `a`, `b`) siguen existiendo porque son la llave entre una pregunta y su
 * respuesta correcta, pero **no se piden**: se generan aquí y no se reutilizan nunca. Si al
 * borrar la pregunta 2 se renumeraran las siguientes, la clave de respuestas de la 3 pasaría
 * a apuntar a la que era la 4.
 */

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_text';

export interface QuestionOption {
  code: string;
  text: string;
}

export interface Question {
  code: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: QuestionOption[];
}

export interface AssessmentDraft {
  instructions: string;
  questions: Question[];
}

export interface AnswerKeyEntry {
  correct: string[];
  points: number;
  feedback?: string;
}

export type AnswerKeyDraft = Record<string, AnswerKeyEntry>;

/** Verdadero y falso son siempre los mismos dos: no se escriben, se ponen. */
export const TRUE_FALSE_OPTIONS: QuestionOption[] = [
  { code: 'v', text: 'Verdadero' },
  { code: 'f', text: 'Falso' },
];

export const QUESTION_TYPES: QuestionType[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_text',
];

/** Los tipos que se responden eligiendo de una lista. */
export const hasOptions = (type: QuestionType): boolean => type !== 'short_text';

/**
 * El siguiente código libre, mirando el mayor que ya existe y no los huecos.
 *
 * Reutilizar un código libre haría que la clave de una pregunta borrada se pegara a la
 * siguiente que ocupara su sitio, y nadie lo vería hasta corregir un examen.
 */
export function nextQuestionCode(questions: Question[]): string {
  const used = questions
    .map((question) => /^p(\d+)$/.exec(question.code))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));

  return `p${Math.max(0, ...used) + 1}`;
}

/** Igual para las opciones, dentro de su pregunta: a, b, c… */
export function nextOptionCode(options: QuestionOption[]): string {
  const used = new Set(options.map((option) => option.code));
  for (let i = 0; i < 26; i += 1) {
    const code = String.fromCharCode(97 + i);
    if (!used.has(code)) return code;
  }
  return `o${options.length + 1}`;
}

export function emptyQuestion(questions: Question[], type: QuestionType): Question {
  const base = { code: nextQuestionCode(questions), type, text: '', points: 1 };

  if (type === 'true_false') return { ...base, options: [...TRUE_FALSE_OPTIONS] };
  if (type === 'short_text') return base;

  // Dos opciones vacías de salida: una pregunta de elección con una sola opción no es una
  // pregunta, y empezar con cero obliga a dos clics antes de poder escribir nada.
  return {
    ...base,
    options: [
      { code: 'a', text: '' },
      { code: 'b', text: '' },
    ],
  };
}

/**
 * Cambiar el tipo de una pregunta ya escrita.
 *
 * Verdadero/falso impone sus dos opciones; respuesta escrita no tiene ninguna; los dos de
 * elección conservan las que hubiera. El enunciado y los puntos no se tocan nunca: son lo que
 * más cuesta escribir.
 */
export function withType(question: Question, type: QuestionType): Question {
  if (type === question.type) return question;

  if (type === 'true_false') return { ...question, type, options: [...TRUE_FALSE_OPTIONS] };

  if (type === 'short_text') {
    // Las opciones se van con el tipo: una respuesta escrita no tiene ninguna.
    const rest = { ...question };
    delete rest.options;
    return { ...rest, type };
  }

  const options =
    question.options && question.options.length >= 2 && question.type !== 'true_false'
      ? question.options
      : [
          { code: 'a', text: '' },
          { code: 'b', text: '' },
        ];

  return { ...question, type, options };
}

export function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

// ─────────────────────────── Leer lo guardado ───────────────────────────

const asType = (value: unknown): QuestionType =>
  QUESTION_TYPES.includes(value as QuestionType) ? (value as QuestionType) : 'single_choice';

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asPoints = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;

/**
 * De lo que hay guardado a lo que la pantalla enseña.
 *
 * Tolerante a propósito con los campos, y **estricta** con la forma: si `questions` no es una
 * lista, no se adivina nada. Un editor que "arregla" contenido que no entendió lo sobrescribe
 * al primer guardado, y lo que había se pierde sin que nadie lo haya pedido.
 */
export function parseDraft(raw: string): { ok: true; draft: AssessmentDraft } | { ok: false } {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value === null || typeof value !== 'object' || !Array.isArray(value.questions)) {
      return { ok: false };
    }

    const questions = (value.questions as Array<Record<string, unknown>>).map(
      (question, index): Question => {
        const type = asType(question.type);
        const code = asText(question.code) || `p${index + 1}`;
        const base = { code, type, text: asText(question.text), points: asPoints(question.points) };

        if (!hasOptions(type)) return base;

        const options = Array.isArray(question.options)
          ? (question.options as Array<Record<string, unknown>>).map(
              (option, position): QuestionOption => ({
                code: asText(option.code) || String.fromCharCode(97 + position),
                text: asText(option.text),
              })
            )
          : [];

        return { ...base, options };
      }
    );

    return { ok: true, draft: { instructions: asText(value.instructions), questions } };
  } catch {
    return { ok: false };
  }
}

/** Y de vuelta, en la forma exacta que valida el servidor. */
export function serializeDraft(draft: AssessmentDraft): unknown {
  return {
    ...(draft.instructions.trim() === '' ? {} : { instructions: draft.instructions }),
    questions: draft.questions.map((question) => ({
      code: question.code,
      type: question.type,
      text: question.text,
      points: question.points,
      ...(hasOptions(question.type) ? { options: question.options ?? [] } : {}),
    })),
  };
}

export function parseAnswerKey(value: unknown): AnswerKeyDraft {
  if (value === null || typeof value !== 'object') return {};

  const out: AnswerKeyDraft = {};

  for (const [code, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const correct = Array.isArray(row.correct)
      ? row.correct.filter((item): item is string => typeof item === 'string')
      : typeof row.correct === 'string'
        ? [row.correct]
        : [];

    out[code] = {
      correct,
      points: asPoints(row.points),
      ...(typeof row.feedback === 'string' && row.feedback !== ''
        ? { feedback: row.feedback }
        : {}),
    };
  }

  return out;
}

/**
 * La clave, lista para guardar.
 *
 * Los puntos salen de la pregunta, no de un segundo campo: el validador exige que coincidan
 * (`points-mismatch`), y pedir el mismo número dos veces solo sirve para que alguien los deje
 * distintos. Las entradas de preguntas que ya no existen se caen aquí (`key-orphan`).
 */
export function serializeAnswerKey(key: AnswerKeyDraft, questions: Question[]): AnswerKeyDraft {
  const out: AnswerKeyDraft = {};

  for (const question of questions) {
    const entry = key[question.code];
    if (!entry || entry.correct.length === 0) continue;

    out[question.code] = {
      correct: entry.correct,
      points: question.points,
      ...(entry.feedback && entry.feedback.trim() !== '' ? { feedback: entry.feedback } : {}),
    };
  }

  return out;
}
