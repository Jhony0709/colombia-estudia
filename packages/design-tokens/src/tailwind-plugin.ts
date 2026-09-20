/**
 * Tailwind CSS plugin for design tokens.
 * SSOT: reference/03-ui/tokens.md
 *
 * Exposes semantic tokens as:
 * - CSS custom properties in :root (light, el tema de partida), .dark (elegido) y
 *   prefers-color-scheme bajo `.theme-system` (seguir al equipo, que es una opción y no el suelo)
 * - Utility classes for colors, typography, spacing, etc.
 *
 * IMPORTANT: Theme properties are OVERWRITTEN, not extended.
 */

import plugin from 'tailwindcss/plugin';
import { light, dark } from './values';
import type { SemanticColorTokens } from './contract/semantic-tokens';

/**
 * Generate CSS custom properties from color tokens.
 */
function generateColorVars(colors: SemanticColorTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  // Surface
  vars['--surface-canvas'] = colors.surface.canvas;
  vars['--surface-base'] = colors.surface.base;
  vars['--surface-sunken'] = colors.surface.sunken;
  vars['--surface-raised'] = colors.surface.raised;
  vars['--surface-note'] = colors.surface.note;

  // Text
  vars['--text-default'] = colors.text.default;
  vars['--text-muted'] = colors.text.muted;
  vars['--text-subtle'] = colors.text.subtle;
  vars['--text-on-accent'] = colors.text.onAccent;
  vars['--text-link'] = colors.text.link;

  // Accent
  vars['--accent-base'] = colors.accent.base;
  vars['--accent-hover'] = colors.accent.hover;
  vars['--accent-active'] = colors.accent.active;

  // Border
  vars['--border-default'] = colors.border.default;
  vars['--border-muted'] = colors.border.muted;

  // Status
  for (const [name, status] of Object.entries(colors.status)) {
    vars[`--status-${name}-base`] = status.base;
    vars[`--status-${name}-muted`] = status.muted;
    vars[`--status-${name}-on-base`] = status.onBase;
  }

  // Focus
  vars['--focus-ring'] = colors.focus.ring;

  // Brand (decorativo, fuera del contrato de contraste)
  vars['--brand-yellow'] = colors.brand.yellow;
  vars['--brand-on-yellow'] = colors.brand.onYellow;
  vars['--brand-red'] = colors.brand.red;

  return vars;
}

/**
 * The design tokens Tailwind plugin.
 */
export const designTokensPlugin = plugin(
  function ({ addBase, addUtilities, addComponents }) {
    /*
      Typography variables (shared between light and dark).

      Recalibrada el 18/9 para un panel de trabajo, no para una portada:

      - `display` baja de 36 a 30 px. 36 es tamaño de titular; el h1 de una pantalla de
        operaciones convive con contenido y a 36 empuja todo lo demás fuera del primer
        pantallazo. Con 30 la jerarquía la siguen dando el peso y el espacio.
      - `subheading` baja de 20 a 18 px y gana interlínea. La distancia con `body` (16) era
        de 4 px: demasiado poca para leerse como otro nivel, así que la sección se apoyaba en
        el peso. A 18 con más aire la diferencia se ve sin forzar el negrita.
      - `caption` SUBE de 12 a 13 px. Es el único que crece, y a propósito: es donde vive el
        texto de ayuda y el estado, y el público lee en un celular de gama media
        (`plan/11-ux.md:20`). Encoger la letra de ayuda es ahorrar donde más cuesta.
      - `body` no se toca. Nunca se toca a la baja.
    */
    const typographyVars = {
      '--type-display-size': '1.875rem',
      '--type-display-line-height': '1.25',
      '--type-display-weight': '700',
      '--type-heading-size': '1.5rem',
      '--type-heading-line-height': '1.3',
      '--type-heading-weight': '600',
      '--type-subheading-size': '1.125rem',
      '--type-subheading-line-height': '1.4',
      '--type-subheading-weight': '600',
      '--type-body-size': '1rem',
      '--type-body-line-height': '1.5',
      '--type-body-weight': '400',
      '--type-data-size': '0.875rem',
      '--type-data-line-height': '1.5',
      '--type-data-weight': '400',
      '--type-caption-size': '0.8125rem',
      '--type-caption-line-height': '1.5',
      '--type-caption-weight': '400',
      '--type-overline-size': '0.75rem',
      '--type-overline-line-height': '1.4',
      '--type-overline-weight': '600',
      '--type-overline-letter-spacing': '0.06em',
      // `label` = texto DENTRO de un control (boton, chip, pestana). No es `body`:
      // no es prosa, no se lee seguido y necesita mas peso para leerse de un vistazo.
      // Sin este rol, Button parcheaba el peso con `font-medium` y usaba
      // `type-subheading` para su tamano grande, vistiendo un control con un rol
      // de encabezado. M3 lo llama igual: "Buttons, for example, use the label large
      // style" (m3.material.io/styles/typography/applying-type).
      // Enfasis: mismo tamano, mas peso. Es la valvula de escape de la regla
      // "nunca un tamano que no sea un rol" (DESIGN.md): sin ella, cuando algo
      // necesitaba destacar sin subir de rango, se parcheaba con `font-medium`
      // suelto y el sistema de roles dejaba de ser la unica fuente del tipo.
      '--type-body-emphasis-weight': '600',
      '--type-label-size': '0.875rem',
      '--type-label-line-height': '1.4',
      '--type-label-weight': '600',
      '--type-label-letter-spacing': '0.01em',
      // Correccion optica: el texto grande se ve suelto y el pequeno se ve apretado.
      // Valores calibrados para Atkinson Hyperlegible Next, que ya es de caja ancha;
      // los de Material estan pensados para Roboto y aqui quedarian excesivos.
      '--type-display-letter-spacing': '-0.015em',
      '--type-caption-letter-spacing': '0.01em',
    };

    // Spacing variables
    const spacingVars = {
      '--space-1': '0.25rem',
      '--space-2': '0.5rem',
      '--space-3': '0.75rem',
      '--space-4': '1rem',
      '--space-6': '1.5rem',
      '--space-8': '2rem',
      '--space-12': '3rem',
    };

    // Radius variables
    /*
      Radios, subidos el 18/9 (6/8/16 → 8/12/20).

      Siguen siendo CUATRO con rol distinto, y eso importa más que los valores: «un solo
      radio para todo, sin importar la jerarquía» es literalmente uno de los tics que delatan
      una pantalla generada (`frontend-colombia-estudia` §3). Lo que cambia es que la
      diferencia entre un control y una tarjeta ahora se ve: 6 contra 8 px no se distinguía.
    */
    const radiusVars = {
      '--radius-control': '0.5rem',
      // 1rem y no 0.75: con el lienzo gris por debajo, 12px deja la tarjeta con aire de caja.
      '--radius-card': '1rem',
      '--radius-sheet': '1.25rem',
      '--radius-pill': '9999px',
    };

    // Size variables
    const sizeVars = {
      '--size-touch-min': '44px',
      '--size-reading-width': '68ch',
      '--size-sidenav': '16rem',
      // 64rem (1024 px), decidido por Jhonny el 19/9 al pasar a lienzo gris con tarjetas
      // blancas: con el marco a 72rem la tarjeta se estiraba y la tabla se leía a saltos.
      '--size-content-max': '64rem',
      // La web pública (19/9): marco editorial de 1240 px, como la referencia. Solo ahí.
      '--size-site-max': '77.5rem',
    };

    // Densidad. Ver `DensityTokens`: `compact` es solo para raton.
    const densityVars = {
      '--density-control-height': '2.75rem',
      '--density-row-height': '3rem',
      '--density-gap': '0.75rem',
    };

    // Duration variables
    const durationVars = {
      '--duration-instant': '0ms',
      '--duration-fast': '150ms',
      '--duration-normal': '300ms',
      '--duration-slow': '500ms',
    };

    // Easing variables
    const easingVars = {
      '--easing-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
      '--easing-enter': 'cubic-bezier(0, 0, 0.2, 1)',
      '--easing-exit': 'cubic-bezier(0.4, 0, 1, 1)',
    };

    // Elevacion: cuatro, y cada una por una razon. Ver `ElevationTokens`.
    const elevationVars = {
      '--elevation-none': 'none',
      // Muy baja a proposito: despega la tarjeta del lienzo sin convertirla en un objeto
      // flotante. Si se nota como sombra, es demasiada.
      '--elevation-resting': '0 1px 2px 0 rgb(12 21 34 / 0.04), 0 1px 3px 0 rgb(12 21 34 / 0.06)',
      '--elevation-floating': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      '--elevation-modal': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    };

    // Claro: es el tema de partida y por eso no lleva clase.
    addBase({
      ':root': {
        ...generateColorVars(light),
        colorScheme: 'light',
        // Para lo que cambia de imagen con el tema (el logo): `only-light` / `only-dark`.
        '--display-only-light': 'block',
        '--display-only-dark': 'none',
        ...typographyVars,
        ...spacingVars,
        ...radiusVars,
        ...sizeVars,
        ...densityVars,
        ...durationVars,
        ...easingVars,
        ...elevationVars,
      },
    });

    // Oscuro por elección explícita.
    addBase({
      '.dark': {
        ...generateColorVars(dark),
        colorScheme: 'dark',
        '--display-only-light': 'none',
        '--display-only-dark': 'block',
      },
    });

    /*
      Oscuro por preferencia del sistema, SOLO con `theme-system` en el `<html>`.

      Hasta el 18/9 esto era `:root:not(.light)`, es decir: el equipo decidía y la aplicación
      obedecía. Ahora el valor de partida es el claro (`apps/web/lib/theme/theme.ts`) y seguir
      al sistema es una de las tres opciones, no el suelo. Quien la elige pone la clase; quien
      no la elige ve claro tenga el equipo como lo tenga.
    */
    addBase({
      '@media (prefers-color-scheme: dark)': {
        ':root.theme-system': {
          ...generateColorVars(dark),
          colorScheme: 'dark',
          '--display-only-light': 'none',
          '--display-only-dark': 'block',
        },
      },
    });

    // Typography utility classes
    addUtilities({
      '.type-display': {
        letterSpacing: 'var(--type-display-letter-spacing)',
        fontSize: 'var(--type-display-size)',
        lineHeight: 'var(--type-display-line-height)',
        fontWeight: 'var(--type-display-weight)',
      },
      '.type-heading': {
        fontSize: 'var(--type-heading-size)',
        lineHeight: 'var(--type-heading-line-height)',
        fontWeight: 'var(--type-heading-weight)',
      },
      '.type-subheading': {
        fontSize: 'var(--type-subheading-size)',
        lineHeight: 'var(--type-subheading-line-height)',
        fontWeight: 'var(--type-subheading-weight)',
      },
      '.type-body': {
        fontSize: 'var(--type-body-size)',
        lineHeight: 'var(--type-body-line-height)',
        fontWeight: 'var(--type-body-weight)',
      },
      '.type-data': {
        fontSize: 'var(--type-data-size)',
        lineHeight: 'var(--type-data-line-height)',
        fontWeight: 'var(--type-data-weight)',
        fontVariantNumeric: 'tabular-nums',
      },
      '.type-body-emphasis': {
        fontSize: 'var(--type-body-size)',
        lineHeight: 'var(--type-body-line-height)',
        fontWeight: 'var(--type-body-emphasis-weight)',
      },
      '.type-label': {
        fontSize: 'var(--type-label-size)',
        lineHeight: 'var(--type-label-line-height)',
        fontWeight: 'var(--type-label-weight)',
        letterSpacing: 'var(--type-label-letter-spacing)',
      },
      '.type-caption': {
        letterSpacing: 'var(--type-caption-letter-spacing)',
        fontSize: 'var(--type-caption-size)',
        lineHeight: 'var(--type-caption-line-height)',
        fontWeight: 'var(--type-caption-weight)',
      },
      '.type-overline': {
        fontSize: 'var(--type-overline-size)',
        lineHeight: 'var(--type-overline-line-height)',
        fontWeight: 'var(--type-overline-weight)',
        letterSpacing: 'var(--type-overline-letter-spacing)',
        textTransform: 'uppercase',
      },
    });

    // Size utilities
    addUtilities({
      '.min-h-touch': {
        minHeight: 'var(--size-touch-min)',
      },
      '.min-w-touch': {
        minWidth: 'var(--size-touch-min)',
      },
      '.max-w-reading': {
        maxWidth: 'var(--size-reading-width)',
      },
      '.w-sidenav': {
        width: 'var(--size-sidenav)',
      },
      '.max-w-content': {
        maxWidth: 'var(--size-content-max)',
      },
      '.max-w-site': {
        maxWidth: 'var(--size-site-max)',
      },
    });

    /*
      La web pública es siempre clara (19/9): el manual la define con mucho blanco y la
      fotografía manda. Esta clase vuelve a declarar las variables del tema claro en un
      subárbol, de modo que la portada se ve igual aunque la cookie `ce-theme` diga oscuro.
    */
    addComponents({
      '.theme-light-scope': {
        ...generateColorVars(light),
        colorScheme: 'light',
        '--display-only-light': 'block',
        '--display-only-dark': 'none',
      },
    });

    /*
      Densidad. Se aplica poniendo `density-compact` o `density-comfortable` en un
      contenedor: las variables cascadean y todo lo que dentro use `h-control`, `h-row` o
      `gap-density` cambia con el contenedor, sin variantes de componente.

      `compact` baja de `--size-touch-min` A PROPOSITO y por eso solo se permite en
      pantallas de staff en escritorio. La regla, y donde esta prohibido, en
      `reference/03-ui/layout-y-componentes.md` §6.
    */
    addUtilities({
      '.density-compact': {
        '--density-control-height': '2.25rem',
        '--density-row-height': '2.5rem',
        '--density-gap': '0.5rem',
      },
      '.density-default': {
        '--density-control-height': '2.75rem',
        '--density-row-height': '3rem',
        '--density-gap': '0.75rem',
      },
      '.density-comfortable': {
        '--density-control-height': '3rem',
        '--density-row-height': '3.5rem',
        '--density-gap': '1rem',
      },
      '.min-h-control': { minHeight: 'var(--density-control-height)' },
      '.min-w-control': { minWidth: 'var(--density-control-height)' },
      // Un elemento por tema, sin JavaScript: el logo a color en claro, el blanco en oscuro.
      // Cubre `.dark` y `.theme-system` a la vez, cosa que `dark:` de Tailwind no haría.
      '.only-light': { display: 'var(--display-only-light)' },
      '.only-dark': { display: 'var(--display-only-dark)' },
      '.min-h-row': { minHeight: 'var(--density-row-height)' },
      '.gap-density': { gap: 'var(--density-gap)' },
    });

    // Elevation utilities
    addUtilities({
      '.elevation-none': { boxShadow: 'var(--elevation-none)' },
      '.elevation-resting': { boxShadow: 'var(--elevation-resting)' },
      '.elevation-floating': { boxShadow: 'var(--elevation-floating)' },
      '.elevation-modal': { boxShadow: 'var(--elevation-modal)' },
    });
  },
  {
    // CORRECTION 9: Theme properties are OVERWRITTEN, not extended
    theme: {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        surface: {
          canvas: 'var(--surface-canvas)',
          base: 'var(--surface-base)',
          sunken: 'var(--surface-sunken)',
          raised: 'var(--surface-raised)',
          note: 'var(--surface-note)',
        },
        text: {
          DEFAULT: 'var(--text-default)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          'on-accent': 'var(--text-on-accent)',
          link: 'var(--text-link)',
        },
        accent: {
          base: 'var(--accent-base)',
          hover: 'var(--accent-hover)',
          active: 'var(--accent-active)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          muted: 'var(--border-muted)',
        },
        status: {
          success: {
            base: 'var(--status-success-base)',
            muted: 'var(--status-success-muted)',
            'on-base': 'var(--status-success-on-base)',
          },
          warning: {
            base: 'var(--status-warning-base)',
            muted: 'var(--status-warning-muted)',
            'on-base': 'var(--status-warning-on-base)',
          },
          error: {
            base: 'var(--status-error-base)',
            muted: 'var(--status-error-muted)',
            'on-base': 'var(--status-error-on-base)',
          },
          info: {
            base: 'var(--status-info-base)',
            muted: 'var(--status-info-muted)',
            'on-base': 'var(--status-info-on-base)',
          },
          locked: {
            base: 'var(--status-locked-base)',
            muted: 'var(--status-locked-muted)',
            'on-base': 'var(--status-locked-on-base)',
          },
          legacy: {
            base: 'var(--status-legacy-base)',
            muted: 'var(--status-legacy-muted)',
            'on-base': 'var(--status-legacy-on-base)',
          },
        },
        focus: {
          ring: 'var(--focus-ring)',
        },
        brand: {
          yellow: 'var(--brand-yellow)',
          'on-yellow': 'var(--brand-on-yellow)',
          red: 'var(--brand-red)',
        },
      },
      // El eje de familia, que hasta hoy no estaba tokenizado: la app heredaba en
      // silencio el stack por defecto de Tailwind. `--font-sans` lo define el cargador
      // de next/font en apps/web/app/fonts/sans.ts; el valor de respaldo dentro de
      // `var()` es deliberado, porque si la variable no existiera (Storybook, un
      // entorno sin Next) la declaracion entera quedaria invalida y el texto caeria
      // al serif del navegador.
      // Tailwind aplica `fontFamily.sans` al <html> desde preflight, asi que no hace
      // falta ninguna clase: definirlo aqui es lo que lo pone en toda la app.
      // OJO: `theme` aqui SOBRESCRIBE, no extiende (ver CORRECTION 9 abajo), por eso
      // `mono` se redeclara: si no, `font-mono` dejaria de existir.
      fontFamily: {
        sans: [
          'var(--font-sans, ui-sans-serif)',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0',
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        sheet: 'var(--radius-sheet)',
        pill: 'var(--radius-pill)',
        full: '9999px',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--easing-standard)',
        enter: 'var(--easing-enter)',
        exit: 'var(--easing-exit)',
      },
    },
  }
);
