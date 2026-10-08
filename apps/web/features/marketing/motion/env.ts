/**
 * Lo que decide cuánto movimiento hay (5/10). Se pregunta en el momento, no se guarda: el
 * usuario puede cambiar la preferencia con la página abierta.
 */

import { motionReduced } from '@/lib/motion/preference';

const matches = (query: string) =>
  typeof window !== 'undefined' && window.matchMedia(query).matches;

/** Movimiento reducido del sistema o de la plataforma (6/10) → estado final directo. */
export const prefersReducedMotion = () => motionReduced();

/** Teléfono o pantalla táctil: desplazamientos cortos, sin parallax ni hover. */
export const isCompact = () =>
  matches('(max-width: 767px)') || matches('(hover: none), (pointer: coarse)');

/** Parallax solo en escritorio con ratón y sin movimiento reducido. */
export const canParallax = () =>
  !prefersReducedMotion() && matches('(min-width: 1024px) and (hover: hover) and (pointer: fine)');

/** Marca un elemento como ya revelado: el CSS deja de ocultarlo. */
export const markIn = (el: Element) => el.setAttribute('data-mo-in', '');

/** ¿Ya está revelado (por la raíz al cargar, o por una animación anterior)? */
export const isIn = (el: Element) => el.hasAttribute('data-mo-in');
