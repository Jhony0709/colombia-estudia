/**
 * Contrast ratio tests for design tokens.
 * SSOT: reference/03-ui/tokens.md
 *
 * Verifies that all declared color pairs meet WCAG 2.2 AA requirements:
 * - 4.5:1 for text
 * - 3:1 for UI components and focus indicators
 */

import {
  contrastRatio,
  meetsWCAG,
  meetsUIContrast,
  getTokenValue,
  hexToRgb,
  relativeLuminance,
} from './contrast';
import { contrastPairs } from './contract/pairs';
import { light, dark } from './values';

describe('hexToRgb', () => {
  it('parses 6-char hex colors', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#1E40AF')).toEqual([30, 64, 175]);
  });

  it('parses 3-char hex colors', () => {
    expect(hexToRgb('#FFF')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
  });

  it('handles hex without #', () => {
    expect(hexToRgb('FFFFFF')).toEqual([255, 255, 255]);
  });

  it('returns null for invalid hex', () => {
    expect(hexToRgb('invalid')).toBeNull();
    expect(hexToRgb('#12')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('calculates luminance for white', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('calculates luminance for black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 2);
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same colors', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('is commutative (order does not matter)', () => {
    const ratio1 = contrastRatio('#1E40AF', '#FFFFFF');
    const ratio2 = contrastRatio('#FFFFFF', '#1E40AF');
    expect(ratio1).toBeCloseTo(ratio2, 2);
  });
});

describe('meetsWCAG', () => {
  it('passes for black on white (AA)', () => {
    expect(meetsWCAG('#000000', '#FFFFFF')).toBe(true);
  });

  it('passes for black on white (AAA)', () => {
    expect(meetsWCAG('#000000', '#FFFFFF', 'AAA')).toBe(true);
  });

  it('fails for low contrast pair', () => {
    expect(meetsWCAG('#CCCCCC', '#FFFFFF')).toBe(false);
  });
});

describe('meetsUIContrast', () => {
  it('passes for blue on white', () => {
    expect(meetsUIContrast('#1E40AF', '#FFFFFF')).toBe(true);
  });
});

describe('getTokenValue', () => {
  it('gets nested token values', () => {
    expect(getTokenValue(light, 'text.default')).toBe('#0F172A');
    expect(getTokenValue(light, 'surface.base')).toBe('#FFFFFF');
    expect(getTokenValue(light, 'status.success.base')).toBe('#15803D');
  });

  it('returns empty string for missing paths', () => {
    expect(getTokenValue(light, 'nonexistent.path')).toBe('');
  });
});

const themes = [
  { name: 'light', values: light },
  { name: 'dark', values: dark },
];

describe.each(themes)('Contrast in $name mode', ({ values }) => {
  it.each(contrastPairs)('%s on %s meets >= %s:1', (fgPath, bgPath, minRatio) => {
    const fg = getTokenValue(values, fgPath);
    const bg = getTokenValue(values, bgPath);

    expect(fg).not.toBe('');
    expect(bg).not.toBe('');

    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});
