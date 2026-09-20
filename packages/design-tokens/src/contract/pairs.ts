/**
 * Contrast pairs to verify.
 * SSOT: reference/03-ui/tokens.md
 *
 * Each pair: [foreground token path, background token path, minimum ratio]
 * - 4.5:1 for text
 * - 3:1 for UI components and focus indicators
 */

type ContrastPair = [fg: string, bg: string, minRatio: number];

/**
 * All contrast pairs that must be verified.
 * These are tested against both light and dark themes.
 */
export const contrastPairs: ContrastPair[] = [
  // Text on surfaces
  ['text.default', 'surface.canvas', 4.5],
  ['text.default', 'surface.base', 4.5],
  ['text.default', 'surface.sunken', 4.5],
  ['text.default', 'surface.raised', 4.5],
  ['text.default', 'surface.note', 4.5],
  ['text.muted', 'surface.base', 4.5],
  ['text.subtle', 'surface.base', 4.5],
  // El control deshabilitado: `text.subtle` sobre `surface.sunken`. No estaba vigilado, y por
  // eso el botón deshabilitado pudo quedarse en 1.05:1 en oscuro sin que nada lo dijera.
  ['text.subtle', 'surface.sunken', 4.5],
  ['text.onAccent', 'accent.base', 4.5],
  ['text.link', 'surface.base', 4.5],

  // Status text on status backgrounds
  ['status.success.onBase', 'status.success.base', 4.5],
  ['status.warning.onBase', 'status.warning.base', 4.5],
  ['status.error.onBase', 'status.error.base', 4.5],
  ['status.info.onBase', 'status.info.base', 4.5],
  ['status.locked.onBase', 'status.locked.base', 4.5],
  ['status.legacy.onBase', 'status.legacy.base', 4.5],

  // Text on status muted backgrounds
  ['text.default', 'status.success.muted', 4.5],
  ['text.default', 'status.warning.muted', 4.5],
  ['text.default', 'status.error.muted', 4.5],
  ['text.default', 'status.info.muted', 4.5],
  ['text.default', 'status.locked.muted', 4.5],
  ['text.default', 'status.legacy.muted', 4.5],

  // Focus ring against surfaces (UI contrast, 3:1)
  ['focus.ring', 'surface.canvas', 3],
  ['focus.ring', 'surface.base', 3],
  ['focus.ring', 'surface.sunken', 3],
  ['focus.ring', 'surface.raised', 3],

  // Accent states (UI contrast, 3:1)
  ['accent.base', 'surface.base', 3],
  ['accent.hover', 'surface.base', 3],
  ['accent.active', 'surface.base', 3],

  // Border contrast (UI contrast, 3:1)
  ['border.default', 'surface.base', 3],

  /*
    La píldora de estado (`atoms/badge`): el color del estado sobre su propio fondo suave.

    Entra al contrato el 18/9 por la misma razón por la que entró `text.subtle` sobre
    `surface.sunken`: era una combinación que la interfaz usaba y que nadie vigilaba. `warning`
    en claro da 4.51 sobre un mínimo de 4.5 — es el par más justo de todo el contrato, y el
    primero que se rompe si alguien retoca los ámbares.
  */
  ['text.muted', 'surface.sunken', 4.5],
  ['status.success.base', 'status.success.muted', 4.5],
  ['status.warning.base', 'status.warning.muted', 4.5],
  ['status.error.base', 'status.error.muted', 4.5],
  ['status.info.base', 'status.info.muted', 4.5],

  // El CTA de la web pública (19/9): lo único escrito sobre el amarillo de marca. Entra al
  // contrato porque es texto de verdad, no decoración; 11.15 en los dos temas.
  ['brand.onYellow', 'brand.yellow', 4.5],
];
