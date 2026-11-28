import { lessonDocument } from '../src/learn/lessonDocument';
import { theme as alba } from '../theme/alba';

const light = { ...alba, mode: 'light' as const, color: alba.color.light };
const dark = { ...alba, mode: 'dark' as const, color: alba.color.dark };

describe('lessonDocument', () => {
  it('paints with the tokens of the mode', () => {
    expect(lessonDocument('<p>x</p>', light, 1)).toContain(
      `color: ${alba.color.light['text.default']}`
    );
    expect(lessonDocument('<p>x</p>', dark, 1)).toContain(
      `color: ${alba.color.dark['text.default']}`
    );
    expect(lessonDocument('<aside>x</aside>', dark, 1)).toContain(
      `background: ${alba.color.dark['app.surface.note']}`
    );
  });

  it('grows the text with the system on iOS', () => {
    expect(lessonDocument('', light, 2)).toContain('font: 32px/1.6');
  });

  it('listens to the Vimeo player and sends its height', () => {
    const html = lessonDocument('', light, 1);
    expect(html).toContain("'https://player.vimeo.com'");
    expect(html).toContain("type: 'height'");
  });
});
