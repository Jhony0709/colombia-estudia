/**
 * Tailwind CSS plugin for design tokens.
 * SSOT: reference/03-ui/tokens.md
 *
 * Exposes semantic tokens as:
 * - CSS custom properties in :root (light) and .dark / prefers-color-scheme (dark)
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

  return vars;
}

/**
 * The design tokens Tailwind plugin.
 */
export const designTokensPlugin = plugin(
  function ({ addBase, addUtilities }) {
    // Typography variables (shared between light and dark)
    const typographyVars = {
      '--type-display-size': '2.25rem',
      '--type-display-line-height': '1.2',
      '--type-display-weight': '700',
      '--type-heading-size': '1.5rem',
      '--type-heading-line-height': '1.3',
      '--type-heading-weight': '600',
      '--type-subheading-size': '1.25rem',
      '--type-subheading-line-height': '1.4',
      '--type-subheading-weight': '600',
      '--type-body-size': '1rem',
      '--type-body-line-height': '1.5',
      '--type-body-weight': '400',
      '--type-data-size': '0.875rem',
      '--type-data-line-height': '1.5',
      '--type-data-weight': '400',
      '--type-caption-size': '0.75rem',
      '--type-caption-line-height': '1.4',
      '--type-caption-weight': '400',
      '--type-overline-size': '0.75rem',
      '--type-overline-line-height': '1.2',
      '--type-overline-weight': '600',
      '--type-overline-letter-spacing': '0.05em',
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
    const radiusVars = {
      '--radius-control': '0.375rem',
      '--radius-card': '0.5rem',
      '--radius-sheet': '1rem',
      '--radius-pill': '9999px',
    };

    // Size variables
    const sizeVars = {
      '--size-touch-min': '44px',
      '--size-reading-width': '68ch',
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

    // Elevation (shadows)
    const elevationVars = {
      '--elevation-0': 'none',
      '--elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--elevation-2': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      '--elevation-3': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    };

    // Light mode (default)
    addBase({
      ':root': {
        ...generateColorVars(light),
        ...typographyVars,
        ...spacingVars,
        ...radiusVars,
        ...sizeVars,
        ...durationVars,
        ...easingVars,
        ...elevationVars,
      },
    });

    // Dark mode via .dark class
    addBase({
      '.dark': {
        ...generateColorVars(dark),
      },
    });

    // Dark mode via media query (correction 8: both entries)
    addBase({
      '@media (prefers-color-scheme: dark)': {
        ':root:not(.light)': {
          ...generateColorVars(dark),
        },
      },
    });

    // Typography utility classes
    addUtilities({
      '.type-display': {
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
      '.type-caption': {
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
    });

    // Elevation utilities
    addUtilities({
      '.elevation-0': { boxShadow: 'var(--elevation-0)' },
      '.elevation-1': { boxShadow: 'var(--elevation-1)' },
      '.elevation-2': { boxShadow: 'var(--elevation-2)' },
      '.elevation-3': { boxShadow: 'var(--elevation-3)' },
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
