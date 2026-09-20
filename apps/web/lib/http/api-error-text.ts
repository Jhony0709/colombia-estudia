/**
 * El error de una API, dicho en cristiano.
 * SSOT: `lib/http/responses.ts` (forma de la respuesta), revisión de UX del 18/9.
 *
 * El servidor contesta `{ error: { code, message, details } }`, y `details` dice **qué campo**
 * falla: `{ learningObjective: ['Invalid input'] }`. Los formularios solo leían `message`, así
 * que un error de validación llegaba a la pantalla como «Invalid request body» —que no dice
 * qué arreglar, no está en español y no señala ningún campo—. Fue exactamente lo que se vio
 * al intentar crear el primer tema real.
 *
 * Aquí se junta el mensaje con los campos, traduciendo el nombre de cada uno. Un campo que no
 * esté en la tabla sale con su nombre técnico: es feo, pero es más útil que esconderlo, y se
 * nota para añadirlo.
 */

/** Nombre de cada campo tal y como lo llama su etiqueta en pantalla. */
const FIELD_NAMES: Record<string, string> = {
  title: 'Título',
  name: 'Nombre',
  code: 'Código',
  description: 'Descripción',
  learningObjective: 'Objetivo de aprendizaje',
  moduleId: 'Módulo',
  subjectId: 'Asignatura',
  programId: 'Programa',
  kind: 'Tipo',
  content: 'Contenido',
  questions: 'Preguntas',
  answerKey: 'Clave de respuestas',
  estimatedMinutes: 'Minutos estimados',
  maxAttempts: 'Intentos',
  timeLimitMinutes: 'Minutos',
  passPercent: 'Porcentaje para aprobar',
  reviewPolicy: 'Qué ve el estudiante después',
  requiresSubmission: 'Se completa con entrega',
  defaultAccessDays: 'Días de acceso por defecto',
  supportEmail: 'Correo de soporte',
  brandColor: 'Color de marca',
};

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * `fallback` es lo que se dice cuando el servidor no contestó nada legible: una caída de red,
 * un 502 del proxy, un HTML de error. Nunca se deja al usuario sin frase.
 */
export function apiErrorText(payload: unknown, fallback: string): string {
  const body = (payload ?? {}) as ApiErrorPayload;
  const message = body.error?.message;
  const details = body.error?.details;

  const fields: string[] = [];

  if (details !== null && typeof details === 'object') {
    for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
      const label = FIELD_NAMES[field] ?? field;
      const first = Array.isArray(value) ? value[0] : value;
      fields.push(typeof first === 'string' && first.trim() !== '' ? `${label}: ${first}` : label);
    }
  }

  if (fields.length > 0) {
    // El mensaje general de un error de validación («Invalid request body») no añade nada
    // cuando ya se dice qué campo falla, así que se cambia por una frase que sí lo hace.
    return `Revisa estos campos — ${fields.join(' · ')}`;
  }

  return message && message.trim() !== '' ? message : fallback;
}
