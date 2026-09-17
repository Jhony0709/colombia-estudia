/**
 * WCAG 2.2 contrast ratio utilities.
 * SSOT: reference/03-ui/tokens.md
 *
 * Used to verify that all declared color pairs meet accessibility requirements.
 */

/**
 * Parse a hex color to RGB values.
 * Supports both 3-char (#RGB) and 6-char (#RRGGBB) formats.
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  // Remove # prefix if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle 3-char format
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0]! + cleanHex[0]!, 16);
    const g = parseInt(cleanHex[1]! + cleanHex[1]!, 16);
    const b = parseInt(cleanHex[2]! + cleanHex[2]!, 16);
    return [r, g, b];
  }

  // Handle 6-char format
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [r, g, b];
  }

  return null;
}

/**
 * Calculate relative luminance of a color.
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = rgb.map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/**
 * Calculate contrast ratio between two colors.
 * @returns Contrast ratio from 1:1 to 21:1
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG AA text contrast (4.5:1).
 */
export function meetsWCAG(fg: string, bg: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = contrastRatio(fg, bg);
  return level === 'AAA' ? ratio >= 7 : ratio >= 4.5;
}

/**
 * Check if a color pair meets WCAG AA UI contrast (3:1).
 * For non-text UI components and graphical objects.
 */
export function meetsUIContrast(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 3;
}

/**
 * Get the value of a token from a flat path like "text.default".
 */
export function getTokenValue(tokens: object, path: string): string {
  const parts = path.split('.');
  let current: unknown = tokens;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return '';
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : '';
}
