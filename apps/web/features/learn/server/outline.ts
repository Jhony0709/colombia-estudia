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
  /** Posición dentro del módulo. Las evaluaciones van después de los temas. */
  position: number;
  status: ItemStatus;
  requiresSubmission?: boolean;
  availableFrom: Date;
  availableUntil: Date | null;
}

export interface SequencedItem extends OutlineItem {
  enabled: boolean;
  /** Título del tema que hay que completar antes. Nulo si no lo bloquea otro ítem. */
  blockedBy: string | null;
  /** Por qué no está disponible, cuando no es por secuencia. */
  unavailableReason: 'NOT_YET' | 'CLOSED' | null;
}

/** Los ítems de un módulo, en el orden en que se recorren: temas y luego evaluaciones. */
export function sortItems(items: OutlineItem[]): OutlineItem[] {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'LESSON' ? -1 : 1;
    return a.position - b.position;
  });
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
  modules: Array<{ id: string; items: OutlineItem[] }>;
  progression: 'LINEAR' | 'FREE';
  now: Date;
}): Map<string, SequencedItem> {
  const result = new Map<string, SequencedItem>();

  // El recorrido es el del programa entero, módulo a módulo y en orden.
  const ordered = modules.flatMap((module) => sortItems(module.items));

  let blocker: string | null = null;

  for (const item of ordered) {
    const windowReason: SequencedItem['unavailableReason'] =
      item.availableFrom > now
        ? 'NOT_YET'
        : item.availableUntil !== null && item.availableUntil < now
          ? 'CLOSED'
          : null;

    const blockedBy = progression === 'LINEAR' ? blocker : null;
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
