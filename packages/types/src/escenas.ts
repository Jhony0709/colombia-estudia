/**
 * Escenas (14/11): `:::escena{tipo="pasos" titulo="…"}` con una lista dentro, en el Markdown de
 * un tema. Convierten un párrafo largo en una secuencia que aparece al llegar a ella: pasos,
 * un ciclo que vuelve a empezar o una línea de tiempo. Desde el 19/11 también ideas sueltas
 * (`conceptos`) y, con sublistas, columnas (`comparar`) o ramas (`mapa`). Sin JavaScript se lee
 * como la lista que es; con movimiento reducido, sin animación.
 *
 * Archivo aparte y sin dependencias, como `callouts.ts`: lo importa el editor en el navegador.
 */

export const ESCENA_TIPOS = ['pasos', 'ciclo', 'linea', 'conceptos', 'comparar', 'mapa'] as const;
export type EscenaTipo = (typeof ESCENA_TIPOS)[number];

export function isEscenaTipo(value: string): value is EscenaTipo {
  return (ESCENA_TIPOS as readonly string[]).includes(value);
}

/** Cuántos elementos caben en una escena: menos no anima nada; más ya no se lee de un vistazo. */
export const ESCENA_MIN = 2;
export const ESCENA_MAX = 8;
/** Columnas de `comparar`: con más, el texto queda apretado. */
export const ESCENA_COLUMNAS_MAX = 3;

/** Títulos por defecto; `titulo=` los sustituye. */
export const ESCENA_TITULOS: Record<EscenaTipo, string> = {
  pasos: 'Paso a paso',
  ciclo: 'El ciclo',
  linea: 'Línea de tiempo',
  conceptos: 'Ideas clave',
  comparar: 'Comparación',
  mapa: 'Mapa del tema',
};
