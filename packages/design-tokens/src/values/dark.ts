/**
 * Dark theme color values.
 * SSOT: reference/03-ui/tokens.md
 *
 * Rediseño del 18/9, mismo tono (214°) que el claro.
 *
 * `accent.base` **no puede ser el azul de marca (#0047BA) aquí**: sobre un lienzo oscuro da
 * 2.33:1 y un azul marino no se ve. Es el mismo tono subido de luminosidad, con texto oscuro encima, que es como el acento
 * funciona en oscuro.
 *
 * El tema oscuro era el frágil: `border.default / surface.base` daba **3.07 con un mínimo de
 * 3**, a una centésima de fallar. Ahora da 4.87. Holgura mínima del tema: +1.87 (antes +0.07).
 */

import type { SemanticColorTokens } from '../contract/semantic-tokens';

export const darkColors: SemanticColorTokens = {
  surface: {
    canvas: '#0B1220',
    base: '#151E2E',
    sunken: '#0F1827',
    raised: '#1E2A3D',
    note: '#3A2A08',
  },
  text: {
    default: '#F6F8FB',
    muted: '#A2B1C4',
    // Igual que `muted`: en oscuro, bajar más rompería el 4.5:1 y `text.subtle` también
    // se usa para deshabilitado, que tiene que seguir siendo legible.
    subtle: '#A2B1C4',
    onAccent: '#08101C',
    link: '#8FB6F0',
  },
  accent: {
    base: '#8FB6F0',
    hover: '#B0CCF6',
    active: '#CFE0FA',
  },
  border: {
    default: '#7B8CA3',
    muted: '#2A374A',
  },
  status: {
    success: {
      base: '#34D07A',
      muted: '#0C3520',
      onBase: '#08101C',
    },
    warning: {
      base: '#F5B93C',
      muted: '#3A2A08',
      onBase: '#08101C',
    },
    error: {
      base: '#F26D6D',
      muted: '#3A0F0F',
      onBase: '#08101C',
    },
    info: {
      base: '#8FB6F0',
      muted: '#12305E',
      onBase: '#08101C',
    },
    locked: {
      base: '#9FADBE',
      muted: '#1B2432',
      onBase: '#08101C',
    },
    legacy: {
      base: '#F0A93C',
      muted: '#3A2A08',
      onBase: '#08101C',
    },
  },
  focus: {
    ring: '#8FB6F0',
  },
  brand: {
    // Los mismos en los dos temas: son la marca, no colores semánticos.
    yellow: '#F5C400',
    onYellow: '#0C1522',
    red: '#D72638',
  },
};
