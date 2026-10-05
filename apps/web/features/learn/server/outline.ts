/**
 * El orden del programa y qué está habilitado. Puro.
 * SSOT: plan/08-aprender-y-evaluar.md:12-19 (§1), reference/01-routing/routes.md:27.
 *
 * Sin base de datos a propósito: la secuencia es la regla que decide si un estudiante puede
 * abrir un tema, y una regla así tiene que poder probarse con una lista escrita a mano.
 * `cohort.service.ts` trae los datos; esto decide.
 */

export type ItemKind = 'LESSON' | 'ASSESSMENT';

export type ItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface OutlineItem {
  kind: ItemKind;
  /** Id de la asignación, que es lo que la URL del player necesita. */
  assignmentId: string;
  title: string;
  moduleId: string;
  /**
   * El tema al que pertenece el ítem: en un `LESSON`, el suyo; en un `ASSESSMENT`, el tema
   * del que es examen (20/9). Un examen sin tema va al final del módulo.
   */
  lessonId?: string | null;
  /**
   * El taller (asignatura) al que pertenece (3/10, cliente: «taller = asignatura»). En un
   * tema, el suyo; en un examen, el de su `subjectId`, o nulo si es del componente entero.
   */
  subjectId?: string | null;
  subjectName?: string | null;
  /** Posición dentro del módulo, entre los ítems de su misma clase. */
  position: number;
  status: ItemStatus;
  requiresSubmission?: boolean;
  /**
   * La forma del ítem, para el icono y la etiqueta (21/9): vídeo, lectura, actividad o
   * examen. Coursera no pinta un ítem sin decir qué es, y tiene razón: «Tema 3» no dice
   * cuánto cuesta abrirlo; «Vídeo · 12 min», sí.
   */
  form?: 'VIDEO' | 'MARKDOWN' | 'SUBMISSION' | 'ASSESSMENT';
  /** Minutos estimados (tema) o límite del intento (examen). Nulo si no se sabe. */
  estimatedMinutes?: number | null;
  /** Fecha límite de entrega (examen). Nula si no tiene o si es un tema. */
  dueAt?: Date | null;
  availableFrom: Date;
  availableUntil: Date | null;
}

export interface SequencedItem extends OutlineItem {
  enabled: boolean;
  /** Título del tema que hay que completar antes. Nulo si no lo bloquea otro ítem. */
  blockedBy: string | null;
  /**
   * Por qué no está disponible, cuando no es por secuencia. `LOCKED` (3/10): su componente
   * todavía no está habilitado para esta matrícula.
   */
  unavailableReason: 'NOT_YET' | 'CLOSED' | 'LOCKED' | null;
}

/**
 * Si el componente está abierto para la matrícula (3/10, cliente): el primero de la ruta
 * siempre; los demás solo con habilitación de operación (`EnrollmentModule`), y dentro de su
 * ventana de fechas si la tiene. En progresión `FREE` todos están abiertos.
 */
export type ModuleAccess =
  | { state: 'OPEN' }
  | { state: 'LOCKED' }
  | { state: 'NOT_YET'; from: Date }
  | { state: 'CLOSED'; until: Date };

export function moduleAccess({
  first,
  unlock,
  progression,
  now,
}: {
  /** Es el primer componente de la ruta de esta matrícula (su grado de entrada). */
  first: boolean;
  /** La habilitación, si existe. */
  unlock: { availableFrom: Date | null; availableUntil: Date | null } | null;
  progression: 'LINEAR' | 'FREE';
  now: Date;
}): ModuleAccess {
  if (progression === 'FREE') return { state: 'OPEN' };
  if (!unlock) return first ? { state: 'OPEN' } : { state: 'LOCKED' };
  if (unlock.availableFrom && unlock.availableFrom > now) {
    return { state: 'NOT_YET', from: unlock.availableFrom };
  }
  if (unlock.availableUntil && unlock.availableUntil < now) {
    return { state: 'CLOSED', until: unlock.availableUntil };
  }
  return { state: 'OPEN' };
}

/**
 * Los ítems de un módulo, en el orden en que se recorren. Desde el 3/10 (reunión con el
 * cliente) el componente se recorre **taller a taller**: los temas de una asignatura, cada uno
 * seguido de sus exámenes, y después el examen de ese taller (examen con `subjectId` y sin
 * tema); luego el siguiente taller. Los talleres van en el orden en que aparece su primer
 * tema. Al final, los exámenes del componente sin taller y los que apuntan a un tema que no
 * está en la lista: mejor visibles fuera de sitio que perdidos.
 *
 * Hasta el 3/10 (regla del 20/9) todos los exámenes sin tema caían al final del componente,
 * y con un cuestionario por taller quedaban los cuatro juntos después del último tema.
 */
export type Sortable = Pick<OutlineItem, 'kind' | 'lessonId' | 'position'> & {
  subjectId?: string | null;
};

/**
 * Genérico sobre lo mínimo que hace falta para ordenar (23/9): el builder del programa
 * (`features/content/server/builder.service.ts`) ordena temas y exámenes sin cohorte y sin
 * fechas con la **misma** función, que es lo que garantiza que el admin construye la ruta
 * que el estudiante recorre.
 */
export function sortItems<T extends Sortable>(items: T[]): T[] {
  const byPosition = (a: T, b: T) => a.position - b.position;
  const lessons = items.filter((item) => item.kind === 'LESSON').sort(byPosition);
  const assessments = items.filter((item) => item.kind === 'ASSESSMENT').sort(byPosition);

  const lessonIds = new Set(
    lessons.flatMap((lesson) => (lesson.lessonId ? [lesson.lessonId] : []))
  );
  const ofLesson = (lessonId: string) =>
    assessments.filter((assessment) => assessment.lessonId === lessonId);
  const loose = assessments.filter(
    (assessment) => !assessment.lessonId || !lessonIds.has(assessment.lessonId)
  );

  // Los talleres, en el orden de su primer tema; los temas sin taller (no debería haber)
  // forman uno propio al final.
  const subjects: Array<string | null> = [];
  for (const lesson of lessons) {
    const subject = lesson.subjectId ?? null;
    if (!subjects.includes(subject)) subjects.push(subject);
  }
  const subjectIds = new Set(subjects.filter((id): id is string => id !== null));

  const ofSubject = (subjectId: string | null) =>
    loose.filter((assessment) => subjectId !== null && assessment.subjectId === subjectId);
  const ofModule = loose.filter(
    (assessment) => !assessment.subjectId || !subjectIds.has(assessment.subjectId)
  );

  return [
    ...subjects.flatMap((subjectId) => [
      ...lessons
        .filter((lesson) => (lesson.subjectId ?? null) === subjectId)
        .flatMap((lesson) => [lesson, ...(lesson.lessonId ? ofLesson(lesson.lessonId) : [])]),
      ...ofSubject(subjectId),
    ]),
    ...ofModule,
  ];
}

/**
 * Decide qué puede abrir el estudiante.
 *
 * Con progresión `LINEAR`, un ítem se habilita cuando **todos los anteriores del programa**
 * están completados — no solo los de su módulo. Un módulo no es una isla: el programa es una
 * ruta y la secuencia la recorre entera.
 *
 * Las ventanas de fecha se miran **después** de la secuencia, y es a propósito: a quien le
 * falta completar el tema anterior le decimos eso, que es lo accionable, y no "todavía no
 * está disponible", que no le dice qué hacer.
 */
export function sequence({
  modules,
  progression,
  now,
}: {
  /** `access` ausente = componente abierto (los tests de secuencia pura y el builder). */
  modules: Array<{ id: string; items: OutlineItem[]; access?: ModuleAccess }>;
  progression: 'LINEAR' | 'FREE';
  now: Date;
}): Map<string, SequencedItem> {
  const result = new Map<string, SequencedItem>();

  // El recorrido es el del programa entero, módulo a módulo y en orden.
  const ordered = modules.flatMap((module) =>
    sortItems(module.items).map((item) => ({ item, access: module.access ?? { state: 'OPEN' } }))
  );

  let blocker: string | null = null;

  for (const { item, access } of ordered) {
    // El componente cerrado manda sobre la secuencia (3/10): «completa el tema 3» no sirve
    // de nada si el componente entero espera a que operación lo habilite.
    const moduleReason: SequencedItem['unavailableReason'] =
      access.state === 'OPEN' ? null : access.state;

    const windowReason: SequencedItem['unavailableReason'] =
      moduleReason ??
      (item.availableFrom > now
        ? 'NOT_YET'
        : item.availableUntil !== null && item.availableUntil < now
          ? 'CLOSED'
          : null);

    const blockedBy = progression === 'LINEAR' && moduleReason === null ? blocker : null;
    const enabled = blockedBy === null && windowReason === null;

    result.set(item.assignmentId, {
      ...item,
      enabled,
      blockedBy,
      // Si ya está bloqueado por secuencia, el motivo de fecha sobra: decir dos cosas a la
      // vez es no decir ninguna.
      unavailableReason: blockedBy === null ? windowReason : null,
    });

    // El primer incompleto bloquea todo lo que venga después, y sigue siendo ÉL quien
    // aparece como bloqueador: decir "completa el tema 3" en el tema 7 es más útil que
    // decir "completa el tema 6".
    if (progression === 'LINEAR' && blocker === null && item.status !== 'COMPLETED') {
      blocker = item.title;
    }
  }

  return result;
}

/**
 * Dónde retomar: el primero empezado y sin terminar, o el siguiente habilitado.
 *
 * Primero el empezado porque volver a donde lo dejaste es lo que uno espera; y si no hay
 * ninguno a medias, el siguiente que se pueda abrir.
 */
export function resumePoint(items: SequencedItem[]): SequencedItem | null {
  const started = items.find((item) => item.status === 'IN_PROGRESS' && item.enabled);
  if (started) return started;

  return items.find((item) => item.enabled && item.status !== 'COMPLETED') ?? null;
}

/**
 * Lo que toca a continuación aunque no se pueda abrir todavía (23/9): el primer ítem sin
 * completar, habilitado o no. Es lo que la tarjeta «Empieza por aquí» necesita cuando
 * `resumePoint` no encuentra nada abierto —la cohorte no ha empezado, o el primer tema tiene
 * fecha—: decir cuál es el primer tema y por qué no se puede abrir aún, en vez de un título
 * solo.
 */
export function nextPoint(items: SequencedItem[]): SequencedItem | null {
  return items.find((item) => item.status !== 'COMPLETED') ?? null;
}

/**
 * El anterior y el siguiente del ítem abierto, en el orden del programa.
 *
 * Devuelve el vecino tal cual, habilitado o no, porque quien pinta decide qué hacer con uno
 * bloqueado: con progresión `LINEAR` el siguiente **está** bloqueado hasta que el actual se
 * completa, y esconderlo dejaría la barra de acciones sin explicar por qué no hay a dónde ir.
 *
 * `null` en los extremos, y `null` en ambos si el id no está en la ruta —que es lo que pasa
 * cuando alguien escribe a mano una asignación de otra cohorte.
 */
export function neighbours(
  ordered: SequencedItem[],
  assignmentId: string
): { previous: SequencedItem | null; next: SequencedItem | null } {
  const index = ordered.findIndex((item) => item.assignmentId === assignmentId);
  if (index === -1) return { previous: null, next: null };

  return {
    previous: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null,
  };
}

/** Cuántos completados sobre cuántos hay: la línea de avance de la cabecera. */
export function progressOf(items: SequencedItem[]): { completed: number; total: number } {
  return {
    completed: items.filter((item) => item.status === 'COMPLETED').length,
    total: items.length,
  };
}

/**
 * El título del taller que empieza en este ítem, o nulo si sigue en el mismo (3/10). Para
 * pintar «Taller: Lengua castellana» una vez por taller en la ruta, sin anidar listas.
 */
export function workshopStart(
  items: ReadonlyArray<Pick<OutlineItem, 'subjectId' | 'subjectName'>>,
  index: number
): string | null {
  const item = items[index];
  if (!item?.subjectName) return null;
  const previous = index > 0 ? items[index - 1] : null;
  return previous && previous.subjectId === item.subjectId ? null : item.subjectName;
}
