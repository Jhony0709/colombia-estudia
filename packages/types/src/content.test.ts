/**
 * Tests for content.ts
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:52-62
 */

import {
  parseLessonMarkdown,
  latexCompiles,
  AssessmentContentSchema,
  AnswerKeySchema,
} from './content';

// ─────────────────────────── parseLessonMarkdown - Syntax ───────────────────────────

describe('parseLessonMarkdown', () => {
  describe('images with asset:<id>', () => {
    it('![texto alternativo](asset:<id>) → AssetRef image', () => {
      // cuid has 25 chars: c + 24 alphanumeric
      const md = '![Descripción de la imagen](asset:cm12345678901234567890123)';
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        id: 'cm12345678901234567890123',
        kind: 'image',
        alt: 'Descripción de la imagen',
      });
      expect(result.issues).toHaveLength(0);
    });

    it('invalid asset ID format → error', () => {
      const md = '![alt](asset:invalid-id)';
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'invalid-asset-id',
        severity: 'error',
      });
    });
  });

  describe('::video{asset="<id>"} directive', () => {
    it('valid video directive → AssetRef video', () => {
      // cuid has 25 chars: c + 24 alphanumeric
      const md = '::video{asset="cm12345678901234567890123"}';
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        id: 'cm12345678901234567890123',
        kind: 'video',
      });
      expect(result.issues).toHaveLength(0);
    });

    it('video without asset attribute → error', () => {
      const md = '::video{}';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'directive-missing-asset',
        severity: 'error',
      });
    });

    it('video with invalid asset ID → error', () => {
      const md = '::video{asset="bad"}';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'invalid-asset-id',
        severity: 'error',
      });
    });
  });

  describe('::audio{asset="<id>"} directive', () => {
    it('valid audio directive → AssetRef audio', () => {
      const md = '::audio{asset="cm12345678901234567890123"}';
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        id: 'cm12345678901234567890123',
        kind: 'audio',
      });
    });
  });

  describe('::pdf{asset="<id>"} directive', () => {
    it('valid pdf directive → AssetRef pdf', () => {
      const md = '::pdf{asset="cm12345678901234567890123"}';
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        id: 'cm12345678901234567890123',
        kind: 'pdf',
      });
    });
  });

  describe(':lang[texto]{en} directive', () => {
    it(':lang with bare language code → langFragment', () => {
      const md = ':lang[The cat is on the table]{en}';
      const result = parseLessonMarkdown(md);

      expect(result.langFragments).toHaveLength(1);
      expect(result.langFragments[0]).toMatchObject({
        lang: 'en',
        text: 'The cat is on the table',
      });
      expect(result.issues).toHaveLength(0);
    });

    it(':lang with explicit lang= attribute → langFragment', () => {
      const md = ':lang[Bonjour]{lang=fr}';
      const result = parseLessonMarkdown(md);

      expect(result.langFragments).toHaveLength(1);
      expect(result.langFragments[0]).toMatchObject({
        lang: 'fr',
      });
    });

    it(':lang with complex BCP-47 code → langFragment', () => {
      const md = ':lang[Hello]{en-US}';
      const result = parseLessonMarkdown(md);

      expect(result.langFragments).toHaveLength(1);
      expect(result.langFragments[0]?.lang).toBe('en-US');
    });

    it(':lang without language code → error', () => {
      const md = ':lang[text]{}';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'lang-missing-code',
        severity: 'error',
      });
    });

    it(':lang with invalid BCP-47 code → error', () => {
      // Single letter 'x' is invalid (BCP-47 requires 2-3 letters)
      const md = ':lang[text]{x}';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'lang-invalid-code',
        severity: 'error',
      });
    });
  });

  describe('$…$ and $$…$$ math expressions', () => {
    it('inline math $…$ → mathExpression', () => {
      const md = 'The formula is $x^2 + y^2 = z^2$.';
      const result = parseLessonMarkdown(md);

      expect(result.mathExpressions).toHaveLength(1);
      expect(result.mathExpressions[0]).toMatchObject({
        value: 'x^2 + y^2 = z^2',
        displayMode: false,
      });
    });

    it('block math $$…$$ → mathExpression with displayMode', () => {
      // Block math requires $$ on separate lines
      const md = '$$\n\\frac{1}{2}\n$$';
      const result = parseLessonMarkdown(md);

      expect(result.mathExpressions).toHaveLength(1);
      expect(result.mathExpressions[0]).toMatchObject({
        value: '\\frac{1}{2}',
        displayMode: true,
      });
    });
  });

  describe('raw HTML rejection', () => {
    it('raw HTML → error with line number', () => {
      const md = 'Some text\n\n<div>HTML content</div>\n\nMore text';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'raw-html',
        severity: 'error',
        line: 3,
      });
    });

    it('<script> tag → error', () => {
      const md = '<script>alert("xss")</script>';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.rule).toBe('raw-html');
    });
  });

  describe('unknown directive', () => {
    it('unknown directive → error', () => {
      const md = '::unknown{attr="value"}';
      const result = parseLessonMarkdown(md);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toMatchObject({
        rule: 'unknown-directive',
        severity: 'error',
      });
    });
  });

  describe('headings extraction', () => {
    it('extracts headings with depth', () => {
      const md = '# Title\n\n## Section 1\n\n### Subsection\n\n## Section 2';
      const result = parseLessonMarkdown(md);

      expect(result.headings).toHaveLength(4);
      expect(result.headings[0]).toMatchObject({ depth: 1, text: 'Title' });
      expect(result.headings[1]).toMatchObject({ depth: 2, text: 'Section 1' });
      expect(result.headings[2]).toMatchObject({ depth: 3, text: 'Subsection' });
      expect(result.headings[3]).toMatchObject({ depth: 2, text: 'Section 2' });
    });
  });

  describe('links extraction', () => {
    it('extracts links with text and URL', () => {
      const md = 'Visit [our website](https://example.com) for more.';
      const result = parseLessonMarkdown(md);

      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toMatchObject({
        url: 'https://example.com',
        text: 'our website',
      });
    });
  });

  describe('tables extraction', () => {
    it('extracts GFM tables', () => {
      const md = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parseLessonMarkdown(md);

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0]?.hasHeader).toBe(true);
    });
  });

  describe('assets extraction multiple', () => {
    it('extracts all assets from complex document', () => {
      // All IDs must be 25 chars (c + 24 alphanumeric)
      const md = `
![Image](asset:cm12345678901234567890123)

::video{asset="cm22345678901234567890123"}

Some text with more content.

::audio{asset="cm32345678901234567890123"}

::pdf{asset="cm42345678901234567890123"}
`;
      const result = parseLessonMarkdown(md);

      expect(result.assets).toHaveLength(4);
      expect(result.assets.map((a) => a.kind)).toEqual(['image', 'video', 'audio', 'pdf']);
    });
  });
});

// ─────────────────────────── latexCompiles ───────────────────────────

describe('latexCompiles', () => {
  it('valid LaTeX → ok: true', () => {
    const result = latexCompiles('\\frac{1}{2}');
    expect(result).toEqual({ ok: true });
  });

  it('complex valid LaTeX → ok: true', () => {
    const result = latexCompiles('\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}');
    expect(result).toEqual({ ok: true });
  });

  it('invalid LaTeX → ok: false with error', () => {
    const result = latexCompiles('\\frac{1}{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });

  it('unknown command → ok: false', () => {
    const result = latexCompiles('\\unknowncommand');
    expect(result.ok).toBe(false);
  });
});

// ─────────────────────────── Assessment Schemas ───────────────────────────

describe('AssessmentContentSchema', () => {
  it('valid assessment content parses', () => {
    const content = {
      instructions: 'Answer all questions',
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: 'What is 2+2?',
          options: [
            { code: 'a', text: '3' },
            { code: 'b', text: '4' },
          ],
          points: 10,
        },
      ],
    };

    const result = AssessmentContentSchema.safeParse(content);
    expect(result.success).toBe(true);
  });

  it('empty question code fails', () => {
    const content = {
      questions: [
        {
          code: '',
          type: 'single_choice',
          text: 'Question',
          points: 10,
        },
      ],
    };

    const result = AssessmentContentSchema.safeParse(content);
    expect(result.success).toBe(false);
  });
});

describe('AnswerKeySchema', () => {
  it('normalizes string correct to array', () => {
    const key = {
      q1: { correct: 'a', points: 10 },
    };

    const result = AnswerKeySchema.parse(key);
    expect(result.q1!.correct).toEqual(['a']);
  });

  it('preserves array correct', () => {
    const key = {
      q1: { correct: ['a', 'b'], points: 10 },
    };

    const result = AnswerKeySchema.parse(key);
    expect(result.q1!.correct).toEqual(['a', 'b']);
  });

  it('includes feedback when provided', () => {
    const key = {
      q1: { correct: 'a', points: 10, feedback: 'Great job!' },
    };

    const result = AnswerKeySchema.parse(key);
    expect(result.q1!.feedback).toBe('Great job!');
  });
});

describe('image-not-asset (contrato :54)', () => {
  it('una imagen con URL externa es error de contrato', () => {
    const parsed = parseLessonMarkdown('![Foto](https://ejemplo.com/foto.png)');
    expect(parsed.assets).toHaveLength(0);
    expect(parsed.issues.map((i) => i.rule)).toContain('image-not-asset');
    expect(parsed.issues[0]?.line).toBe(1);
  });

  it('una imagen asset: válida no produce issue', () => {
    const parsed = parseLessonMarkdown('![Foto del aula](asset:cm1abcdefghijklmnopqrstuv)');
    expect(parsed.issues).toHaveLength(0);
    expect(parsed.assets).toHaveLength(1);
  });
});
