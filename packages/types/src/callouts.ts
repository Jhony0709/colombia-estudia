/**
 * Callouts (27/9): `:::callout{kind="note"}` … `:::` en el Markdown de un tema.
 *
 * Archivo aparte y sin dependencias: lo importa el editor de bloques en el navegador, y
 * `content.ts` / `render.ts` arrastran katex y unified, que el cliente no necesita para saber
 * qué tipos de recuadro existen.
 */

/**
 * `goals` (27/9) es «En este tema aprenderás»: se ve como una nota y, en pantallas anchas, el
 * player lo lleva a la columna derecha del contenido (`globals.css`, `.callout-goals`).
 */
export const CALLOUT_KINDS = ['note', 'example', 'important', 'goals'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export function isCalloutKind(value: string): value is CalloutKind {
  return (CALLOUT_KINDS as readonly string[]).includes(value);
}

/** Títulos por defecto, en el idioma del contenido de la plataforma. `title=` los sustituye. */
export const CALLOUT_TITLES: Record<CalloutKind, string> = {
  note: 'Nota',
  example: 'Ejemplo',
  important: 'Importante',
  goals: 'En este tema aprenderás',
};
