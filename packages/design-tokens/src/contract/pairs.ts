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
];
