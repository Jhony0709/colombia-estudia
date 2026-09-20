/**
 * Light theme color values.
 * SSOT: reference/03-ui/tokens.md
 *
 * Rediseño del 18/9. Tres decisiones, y ninguna es de gusto:
 *
 * 1. **Los neutros salen del tono del acento** (214°) a saturación muy baja, en vez de ser
 *    un gris genérico. Un gris inventado es uno de los tics que delata una pantalla generada
 *    (`frontend-colombia-estudia` §3); uno derivado de la marca se lee como decidido.
 * 2. **`border.muted` es pelo de verdad** (#DDE3EC) y agrupa; **`border.default` sigue
 *    delimitando lo interactivo** y por eso conserva su 3:1. Antes los dos eran grises medios
 *    y el borde competía con el contenido.
 * 3. **`accent.base` es el Azul Principal del manual de marca, #0047BA** (19/9; el 18/9 fue
 *    #123B7A). `hover` aclara y `active` es el Azul Oscuro del manual, #0D2E6E, que así tiene
 *    un sitio real en la interfaz. `text.link`, `status.info` y `focus.ring` se mueven con él:
 *    el `#1D4ED8` que compartían info y foco daba 1.20:1 contra el nuevo acento, es decir, era
 *    el mismo azul. Ver PRODUCT_DECISIONS.md (19/9, marca).
 *
 * El tema oscuro **no** adopta el hex del manual: #0047BA sobre `#0B1220` da 2.33:1. Allí
 * manda `#8FB6F0`, el mismo tono a la luminosidad que el fondo exige (values/dark.ts:7).
 *
 * Todos los pares del contrato verificados con `contrastRatio` y `contrastPairs` antes de
 * escribir estos valores. El 18/9, al entrar la píldora de estado, el contrato pasó de 30 a
 * 35 pares: 70 comprobaciones entre los dos temas, 0 fallos. Con la paleta de marca (19/9)
 * sigue en 0 fallos; holgura mínima del tema claro +0.53 (`status.warning.base / muted`, 5.03).
 */

import type { SemanticColorTokens } from '../contract/semantic-tokens';

export const lightColors: SemanticColorTokens = {
  surface: {
    // Gris Claro del manual de marca, tal cual.
    canvas: '#F3F5F8',
    base: '#FFFFFF',
    // Un escalón por debajo del lienzo, para que el pozo siga leyéndose como pozo.
    sunken: '#EAEEF4',
    raised: '#FFFFFF',
    note: '#FEF4DC',
  },
  text: {
    default: '#0C1522',
    muted: '#495A70',
    subtle: '#566579',
    onAccent: '#FFFFFF',
    link: '#0047BA',
  },
  accent: {
    base: '#0047BA',
    hover: '#0052D6',
    active: '#0D2E6E',
  },
  border: {
    // Delimita algo interactivo: mantiene 3:1 sobre `surface.base` (4.36).
    default: '#6B7A90',
    // Agrupa. Pelo, sin contraste exigido: no debe competir con el contenido.
    muted: '#DDE3EC',
  },
  status: {
    success: {
      // Bajado de #15803D el 18/9, por lo mismo que `warning`: sobre `success.muted` daba
      // 4.57 con un mínimo de 4.5 en cuanto la píldora de estado entró al contrato. Ahora
      // 5.27, y el blanco encima pasa de 5.02 a 5.79.
      base: '#137537',
      muted: '#DCFCE7',
      onBase: '#FFFFFF',
    },
    warning: {
      // Ámbar oscurecido a naranja quemado: el #CA8A04 anterior obligaba a texto oscuro
      // encima y dejaba el chip con menos contraste que sus hermanos.
      //
      // Bajado otro escalón el 18/9, de #B45309 a #A94D08, al entrar la píldora de estado
      // (`atoms/badge`) al contrato: sobre `warning.muted` daba **4.51 con un mínimo de
      // 4.5**, la misma clase de margen que ya pasó con `border.default` en oscuro. Ahora da
      // 5.03, y de paso el blanco sobre el naranja sube de 5.02 a 5.60.
      base: '#A94D08',
      muted: '#FEF3C7',
      onBase: '#FFFFFF',
    },
    error: {
      base: '#BE1D1D',
      muted: '#FDE7E7',
      onBase: '#FFFFFF',
    },
    info: {
      // El mismo azul que el acento (19/9): dos azules casi iguales conviviendo era peor que
      // uno. La píldora se distingue del botón por la forma, no por el tono.
      base: '#0047BA',
      muted: '#DCE7FA',
      onBase: '#FFFFFF',
    },
    locked: {
      base: '#5F6B7A',
      muted: '#EEF1F5',
      onBase: '#FFFFFF',
    },
    legacy: {
      base: '#92400E',
      muted: '#FEF3C7',
      onBase: '#FFFFFF',
    },
  },
  focus: {
    // El anillo va con `outline-offset: 3px` (globals.css), así que nunca está sobre el
    // botón sino sobre la superficie que lo rodea; lo que se mide es ring / superficies
    // (12.86 sobre blanco). Azul Oscuro del manual: misma familia que el acento, otra
    // luminosidad, para que no se lea como el botón repetido.
    ring: '#0D2E6E',
  },
  brand: {
    // Amarillo Inspiración del manual. Decorativo (logo, subrayado corto de títulos de
    // área) y fondo del CTA de la web pública. Nunca texto, icono ni único indicador de
    // estado: 1.64:1 sobre blanco.
    yellow: '#F5C400',
    // Lo único que puede ir escrito sobre el amarillo: 11.15:1. Igual en los dos temas.
    onYellow: '#0C1522',
    // Rojo Impulso del manual. Solo en el logo y en las formas decorativas de la web pública.
    red: '#D72638',
  },
};
