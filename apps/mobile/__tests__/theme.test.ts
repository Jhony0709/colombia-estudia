import { dark, light } from '@colombia-estudia/design-tokens';
import { theme } from '../theme/alba';

const lower = (hex: string) => hex.toLowerCase();

describe('ALBA theme', () => {
  it.each([
    ['light', light, theme.color.light],
    ['dark', dark, theme.color.dark],
  ] as const)('keeps the values of the contract in %s', (_, alba, native) => {
    // Equivalencias de reference/03-ui/tokens.md, «Tema nativo».
    const pairs: [string, string][] = [
      [alba.surface.canvas, native['surface.page']],
      [alba.surface.base, native['surface.base']],
      [alba.surface.raised, native['surface.raised']],
      [alba.surface.sunken, native['surface.sunken']],
      [alba.text.default, native['text.default']],
      [alba.text.muted, native['text.muted']],
      [alba.text.link, native['text.accent']],
      [alba.text.onAccent, native['text.on-accent']],
      [alba.accent.base, native['accent.9']],
      [alba.accent.hover, native['accent.10']],
      [alba.focus.ring, native['focus.ring']],
      [alba.surface.note, native['app.surface.note']],
      [alba.status.locked.base, native['app.status.locked.base']],
      [alba.status.locked.muted, native['app.status.locked.muted']],
      [alba.status.locked.onBase, native['app.status.locked.on-base']],
      [alba.brand.yellow, native['app.brand.yellow']],
      [alba.brand.onYellow, native['app.brand.on-yellow']],
      [alba.brand.red, native['app.brand.red']],
    ];
    for (const [want, got] of pairs) expect(lower(got)).toBe(lower(want));
  });

  it('touches at 44 points and draws the focus ring 3 wide', () => {
    expect(theme.size['target.min']).toBe(44);
    expect(theme.size['focus.width']).toBe(3);
  });
});
