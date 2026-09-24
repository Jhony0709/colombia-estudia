/**
 * Eventos de uso del estudiante (E0 de la decisión del estudiante, 23/9): el vocabulario
 * cerrado —tipos, pantallas, acciones— y la función que los manda desde el navegador.
 *
 * El vocabulario vive aquí y no en `features/learn/server` para que el componente que lo
 * usa (`PrimaryActionTracker`) no dependa de código de servidor (`.dependency-cruiser.js`,
 * `components-no-servicios`). Sin PII por construcción: todo son enumeraciones o ids de
 * asignación.
 */

export const STUDENT_EVENT_TYPES = [
  'student.primary_action.shown',
  'student.primary_action.clicked',
  // E1 (23/9): cuánto tardó una petición del estudiante y cómo acabó. De aquí saldrán
  // los umbrales de «está tardando» (`lib/net/slow-request.ts`), no al revés.
  'student.request.finished',
] as const;
export type StudentEventType = (typeof STUDENT_EVENT_TYPES)[number];

/** Qué pantalla enseñó la acción. */
export const STUDENT_SCREENS = ['aprender', 'lesson', 'assessment'] as const;
export type StudentScreen = (typeof STUDENT_SCREENS)[number];

/** Qué era la acción: lo que el embudo necesita distinguir. */
export const STUDENT_ACTIONS = [
  'start', // «Empezar con …» en /aprender
  'resume', // «Seguir con …» en /aprender
  'next', // «Siguiente: …» en el player
  'exam', // «Ir al examen: …» en el player
  'submit', // «Enviar actividad» / «Enviar nueva versión»
  'blocked', // la barra explica por qué no hay a dónde ir
  'attempt_start', // «Empezar el intento»
  'attempt_continue', // «Continuar el intento»
] as const;
export type StudentAction = (typeof STUDENT_ACTIONS)[number];

export const STUDENT_FORMS = ['VIDEO', 'MARKDOWN', 'SUBMISSION', 'ASSESSMENT'] as const;

/** Qué petición se midió (`student.request.finished`). */
export const STUDENT_REQUESTS = [
  'submission', // enviar la actividad (subida + POST)
  'attempt_start', // empezar o continuar un intento
  'evidence', // mandar la evidencia de un tema
  'attempt_save', // autosave del intento
] as const;
export type StudentRequest = (typeof STUDENT_REQUESTS)[number];

export const REQUEST_OUTCOMES = ['ok', 'slow_ok', 'failed'] as const;

export interface StudentEventPayload {
  screen: StudentScreen;
  action: StudentAction;
  assignmentId?: string;
  /** La forma del ítem (vídeo, lectura, actividad, examen) si aplica. */
  form?: (typeof STUDENT_FORMS)[number];
  /** Solo en `student.request.finished`. */
  request?: StudentRequest;
  outcome?: (typeof REQUEST_OUTCOMES)[number];
  /** Milisegundos, entero. Solo en `student.request.finished`. */
  durationMs?: number;
}

/**
 * Manda un evento desde el navegador. `fetch` con `keepalive` para que un clic que navega
 * no se pierda; sin esperar la respuesta y sin reintentos: un evento perdido es una cifra
 * menos, no un dato del estudiante. Falla en silencio a propósito.
 */
export function trackStudentEvent(
  type: StudentEventType,
  payload: StudentEventPayload,
  enrollmentId: string | null = null
): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/learn/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, enrollmentId, payload }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Nada: ver arriba.
  }
}
