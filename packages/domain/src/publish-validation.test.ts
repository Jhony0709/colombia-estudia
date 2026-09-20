/**
 * Tests for publish-validation.ts
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:112-138
 *
 * Each row in the validation table is a test.
 */

import { validateLessonForPublish, validateAssessmentForPublish } from './publish-validation';
import type { ParsedLesson, LessonAssetInfo } from '@colombia-estudia/types';
import { parseLessonMarkdown } from '@colombia-estudia/types';

// ─────────────────────────── Test Helpers ───────────────────────────

function createAsset(overrides: Partial<LessonAssetInfo> & { id: string }): LessonAssetInfo {
  return {
    institutionId: 'inst1',
    kind: 'IMAGE',
    status: 'READY',
    captionsSource: 'NONE',
    transcriptPath: null,
    textAlternativePath: null,
    altText: null,
    ...overrides,
  };
}

function createParsedLesson(md: string): ParsedLesson {
  return parseLessonMarkdown(md);
}

function validateLesson(
  md: string,
  assets: Map<string, LessonAssetInfo> = new Map(),
  options: { institutionId?: string; subjectName?: string } = {}
) {
  const parsed = createParsedLesson(md);
  return validateLessonForPublish({
    parsed,
    assets,
    institutionId: options.institutionId ?? 'inst1',
    lesson: { language: 'es', subjectName: options.subjectName ?? 'Matemáticas' },
  });
}

// ─────────────────────────── Lesson Validation - Images ───────────────────────────

describe('validateLessonForPublish - contenido vacío', () => {
  // Un tema recién creado no tiene nada escrito. Antes del 18/9 el editor decía "cumple las
  // reglas de publicación" sobre un borrador en blanco: todas las demás reglas miran lo que
  // hay, y cuando no hay nada no encuentran nada que objetar.
  it.each(['', '   ', '\n\n\n', '   \n  \n'])('un borrador en blanco (%j) no publica', (md) => {
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain('content-empty');
  });

  it('un párrafo ya es contenido', () => {
    const result = validateLesson('Una sola línea, pero escrita.\n');

    expect(result.errors.map((e) => e.rule)).not.toContain('content-empty');
  });

  it('un tema con encabezado y texto tampoco lo dispara', () => {
    const result = validateLesson('## Sección\n\nUn párrafo de contenido.\n');

    expect(result.ok).toBe(true);
  });
});

describe('validateLessonForPublish - images', () => {
  it('Toda imagen tiene alt descriptivo - ![](…) rechazado (image-alt-required)', () => {
    const md = '![](asset:cm12345678901234567890123)';
    const assets = new Map([
      ['cm12345678901234567890123', createAsset({ id: 'cm12345678901234567890123' })],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'image-alt-required')).toBe(true);
  });

  it('Toda imagen tiene alt descriptivo - ![IMG_2024.png](…) rechazado (image-alt-not-filename)', () => {
    const md = '![IMG_2024.png](asset:cm12345678901234567890123)';
    const assets = new Map([
      ['cm12345678901234567890123', createAsset({ id: 'cm12345678901234567890123' })],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'image-alt-not-filename')).toBe(true);
  });

  it('Alt < 3 caracteres rechazado (image-alt-descriptive)', () => {
    const md = '![ab](asset:cm12345678901234567890123)';
    const assets = new Map([
      ['cm12345678901234567890123', createAsset({ id: 'cm12345678901234567890123' })],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'image-alt-descriptive')).toBe(true);
  });

  it('Gráfico con datos (alt > 250) sin tabla cerca → warning (chart-needs-data-table)', () => {
    const longAlt = 'A'.repeat(251);
    const md = `![${longAlt}](asset:cm12345678901234567890123)`;
    const assets = new Map([
      ['cm12345678901234567890123', createAsset({ id: 'cm12345678901234567890123' })],
    ]);
    const result = validateLesson(md, assets);

    expect(result.warnings.some((w) => w.rule === 'chart-needs-data-table')).toBe(true);
  });
});

// ─────────────────────────── Lesson Validation - Video/Audio ───────────────────────────

describe('validateLessonForPublish - video/audio', () => {
  it('Video sin subtítulos revisados ni transcripción: aviso, no rechazo (video-needs-captions, 19/9)', () => {
    const md = '::video{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'VIDEO',
          captionsSource: 'AUTO',
          transcriptPath: null,
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(true);
    expect(result.errors.some((e) => e.rule === 'video-needs-captions')).toBe(false);
    expect(result.warnings.some((w) => w.rule === 'video-needs-captions')).toBe(true);
  });

  it('Video con captionsSource REVIEWED → ok', () => {
    const md = '::video{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'VIDEO',
          captionsSource: 'REVIEWED',
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.warnings.some((w) => w.rule === 'video-needs-captions')).toBe(false);
  });

  it('Video con transcriptPath → ok', () => {
    const md = '::video{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'VIDEO',
          captionsSource: 'NONE',
          transcriptPath: '/path/to/transcript.vtt',
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.errors.some((e) => e.rule === 'video-needs-captions')).toBe(false);
  });

  it('Audio sin subtítulos ni transcripción: aviso, no rechazo (audio-needs-captions, 19/9)', () => {
    const md = '::audio{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'AUDIO',
          captionsSource: 'NONE',
          transcriptPath: null,
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(true);
    expect(result.errors.some((e) => e.rule === 'audio-needs-captions')).toBe(false);
    expect(result.warnings.some((w) => w.rule === 'audio-needs-captions')).toBe(true);
  });
});

// ─────────────────────────── Lesson Validation - PDF ───────────────────────────

describe('validateLessonForPublish - PDF', () => {
  it('PDF sin textAlternativePath rechazado (pdf-needs-text-alternative)', () => {
    const md = '::pdf{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'DOCUMENT',
          textAlternativePath: null,
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'pdf-needs-text-alternative')).toBe(true);
  });

  it('PDF con textAlternativePath → ok', () => {
    const md = '::pdf{asset="cm12345678901234567890123"}';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          kind: 'DOCUMENT',
          textAlternativePath: '/path/to/text.md',
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.errors.some((e) => e.rule === 'pdf-needs-text-alternative')).toBe(false);
  });
});

// ─────────────────────────── Lesson Validation - Assets ───────────────────────────

describe('validateLessonForPublish - assets', () => {
  it('Asset no encontrado rechazado (asset-not-found)', () => {
    const md = '![Description](asset:cm12345678901234567890123)';
    const assets = new Map<string, LessonAssetInfo>();
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'asset-not-found')).toBe(true);
  });

  it('Asset de otra institución rechazado (asset-other-institution)', () => {
    const md = '![Description](asset:cm12345678901234567890123)';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          institutionId: 'other-inst',
        }),
      ],
    ]);
    const result = validateLesson(md, assets, { institutionId: 'inst1' });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'asset-other-institution')).toBe(true);
  });

  it('Asset no READY rechazado (asset-not-ready)', () => {
    const md = '![Description](asset:cm12345678901234567890123)';
    const assets = new Map([
      [
        'cm12345678901234567890123',
        createAsset({
          id: 'cm12345678901234567890123',
          status: 'PENDING',
        }),
      ],
    ]);
    const result = validateLesson(md, assets);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'asset-not-ready')).toBe(true);
  });
});

// ─────────────────────────── Lesson Validation - LaTeX ───────────────────────────

describe('validateLessonForPublish - LaTeX', () => {
  it('LaTeX que compila → ok', () => {
    const md = 'La fórmula es $x^2 + y^2 = z^2$.';
    const result = validateLesson(md);

    expect(result.ok).toBe(true);
  });

  it('LaTeX inválido rechazado (latex-must-compile)', () => {
    const md = 'La fórmula es $\\frac{1}{$.';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'latex-must-compile')).toBe(true);
  });
});

// ─────────────────────────── Lesson Validation - Headings ───────────────────────────

describe('validateLessonForPublish - headings', () => {
  it('# en el cuerpo rechazado - h1 reservado (heading-h1-reserved)', () => {
    const md = '# Título no permitido\n\nContenido';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'heading-h1-reserved')).toBe(true);
  });

  it('Salto de nivel de encabezado rechazado (heading-level-skip)', () => {
    const md = '## Sección\n\n#### Subsección saltada';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'heading-level-skip')).toBe(true);
  });

  it('Niveles consecutivos → ok', () => {
    const md = '## Sección\n\n### Subsección\n\n#### Más profundo';
    const result = validateLesson(md);

    expect(result.errors.some((e) => e.rule === 'heading-level-skip')).toBe(false);
  });
});

// ─────────────────────────── Lesson Validation - Links ───────────────────────────

describe('validateLessonForPublish - links', () => {
  it('"clic aquí" rechazado (link-text-descriptive)', () => {
    const md = '[clic aquí](https://example.com)';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'link-text-descriptive')).toBe(true);
  });

  it('"ver más" rechazado (link-text-descriptive)', () => {
    const md = '[ver más](https://example.com)';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'link-text-descriptive')).toBe(true);
  });

  it('URL como texto rechazado (link-text-descriptive)', () => {
    const md = '[https://example.com](https://example.com)';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'link-text-descriptive')).toBe(true);
  });

  it('Texto descriptivo → ok', () => {
    const md = '[Visita nuestra documentación](https://example.com)';
    const result = validateLesson(md);

    expect(result.errors.some((e) => e.rule === 'link-text-descriptive')).toBe(false);
  });
});

// ─────────────────────────── Lesson Validation - Tables ───────────────────────────

describe('validateLessonForPublish - tables', () => {
  it('Tabla con encabezado vacío rechazada (table-needs-header)', () => {
    const md = '|   |   |\n|---|---|\n| 1 | 2 |';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'table-needs-header')).toBe(true);
  });

  it('Tabla con encabezado válido → ok', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = validateLesson(md);

    expect(result.errors.some((e) => e.rule === 'table-needs-header')).toBe(false);
  });
});

// ─────────────────────────── Lesson Validation - Syntax ───────────────────────────

describe('validateLessonForPublish - syntax', () => {
  it('HTML crudo rechazado (raw-html)', () => {
    const md = '<div>contenido</div>';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'raw-html')).toBe(true);
  });

  it('Directiva desconocida rechazada (unknown-directive)', () => {
    const md = '::unknown{attr="value"}';
    const result = validateLesson(md);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'unknown-directive')).toBe(true);
  });
});

// ─────────────────────────── Lesson Validation - English ───────────────────────────

describe('validateLessonForPublish - English lessons', () => {
  it('Lección de Inglés sin :lang{en} → warning (english-lesson-needs-lang)', () => {
    const md = '## Content\n\nSome text without lang directive.';
    const result = validateLesson(md, new Map(), { subjectName: 'Inglés' });

    expect(result.warnings.some((w) => w.rule === 'english-lesson-needs-lang')).toBe(true);
  });

  it('Lección de Inglés con :lang{en} → ok', () => {
    const md = '## Content\n\n:lang[Hello world]{en}';
    const result = validateLesson(md, new Map(), { subjectName: 'Inglés' });

    expect(result.warnings.some((w) => w.rule === 'english-lesson-needs-lang')).toBe(false);
  });

  it('Lección no de Inglés sin :lang → ok (sin warning)', () => {
    const md = '## Content\n\nContenido en español.';
    const result = validateLesson(md, new Map(), { subjectName: 'Matemáticas' });

    expect(result.warnings.some((w) => w.rule === 'english-lesson-needs-lang')).toBe(false);
  });
});

// ─────────────────────────── Assessment Validation ───────────────────────────

describe('validateAssessmentForPublish - questions-required', () => {
  // Una evaluación sin preguntas pasaba todas las demás reglas: nada que duplicar, ninguna
  // clave que falte, ningún punto que no cuadre. Habría llegado a una cohorte como un
  // examen en blanco que califica 0/0. Decisión de Jhonny, 17/9.
  it('Una evaluación sin preguntas NO publica', () => {
    const result = validateAssessmentForPublish({ content: { questions: [] }, answerKey: {} });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'questions-required')).toBe(true);
  });

  it('Tener instrucciones no sustituye a tener preguntas', () => {
    const result = validateAssessmentForPublish({
      content: { instructions: 'Lee con calma.', questions: [] },
      answerKey: {},
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'questions-required')).toBe(true);
  });
});

describe('validateAssessmentForPublish - schema', () => {
  it('Contenido válido → ok', () => {
    const content = {
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
    const answerKey = {
      q1: { correct: 'b', points: 10 },
    };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(true);
  });

  it('Contenido inválido → schema-content error', () => {
    const content = {
      questions: [{ code: '', type: 'single_choice', text: 'Q', points: 10 }],
    };
    const answerKey = {};

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'schema-content')).toBe(true);
  });
});

describe('validateAssessmentForPublish - statement', () => {
  it('Enunciado vacío rechazado (statement-not-empty)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: '  ',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'statement-not-empty')).toBe(true);
  });

  it('Imagen sin alt en enunciado rechazada (statement-images-alt)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: '![](asset:cm12345678901234567890123)',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'statement-images-alt')).toBe(true);
  });
});

describe('validateAssessmentForPublish - single_choice/true_false', () => {
  it('single_choice con < 2 opciones rechazado (options-minimum)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: 'Q?',
          options: [{ code: 'a', text: 'A' }],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'options-minimum')).toBe(true);
  });

  it('true_false con != 2 opciones rechazado (true-false-two-options)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'true_false',
          text: 'Q?',
          options: [
            { code: 'a', text: 'True' },
            { code: 'b', text: 'False' },
            { code: 'c', text: 'Maybe' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'true-false-two-options')).toBe(true);
  });

  it('Más de una respuesta correcta para single_choice rechazado (single-correct)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: 'Q?',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: ['a', 'b'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'single-correct')).toBe(true);
  });

  it('Respuesta correcta inexistente rechazada (correct-exists)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: 'Q?',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'c', points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'correct-exists')).toBe(true);
  });
});

describe('validateAssessmentForPublish - multiple_choice', () => {
  it('multiple_choice sin respuesta correcta rechazado (multiple-correct-minimum)', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'multiple_choice',
          text: 'Q?',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: [], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'multiple-correct-minimum')).toBe(true);
  });

  it('multiple_choice válido → ok', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'multiple_choice',
          text: 'Q?',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
            { code: 'c', text: 'C' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: ['a', 'c'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(true);
  });
});

describe('validateAssessmentForPublish - short_text', () => {
  it('short_text sin respuestas aceptadas rechazado (short-text-answers)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Capital de Colombia?', points: 10 }],
    };
    const answerKey = { q1: { correct: [], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'short-text-answers')).toBe(true);
  });

  it('short_text con respuesta vacía rechazado (short-text-answer-not-empty)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Capital?', points: 10 }],
    };
    const answerKey = { q1: { correct: ['Bogotá', ''], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'short-text-answer-not-empty')).toBe(true);
  });

  it('short_text válido → ok', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Capital de Colombia?', points: 10 }],
    };
    const answerKey = { q1: { correct: ['Bogotá', 'Bogota'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(true);
  });
});

describe('validateAssessmentForPublish - key correspondence', () => {
  it('Pregunta sin clave rechazada (key-missing)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10 }],
    };
    const answerKey = {};

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'key-missing')).toBe(true);
  });

  it('Clave huérfana rechazada (key-orphan)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10 }],
    };
    const answerKey = {
      q1: { correct: ['A'], points: 10 },
      q2: { correct: ['B'], points: 10 },
    };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'key-orphan')).toBe(true);
  });

  it('Points mismatch rechazado (points-mismatch)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10 }],
    };
    const answerKey = { q1: { correct: ['A'], points: 5 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'points-mismatch')).toBe(true);
  });

  it('Código duplicado rechazado (code-unique)', () => {
    const content = {
      questions: [
        { code: 'q1', type: 'short_text', text: 'Q1?', points: 10 },
        { code: 'q1', type: 'short_text', text: 'Q2?', points: 10 },
      ],
    };
    const answerKey = { q1: { correct: ['A'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'code-unique')).toBe(true);
  });
});

describe('validateAssessmentForPublish - answer key leak', () => {
  it('Contenido con "correct" rechazado (answer-key-leak)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10, correct: 'leaked' }],
    };
    const answerKey = { q1: { correct: ['A'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'answer-key-leak')).toBe(true);
  });

  it('Contenido con "answerKey" rechazado (answer-key-leak)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10 }],
      answerKey: { q1: { correct: ['leaked'] } },
    };
    const answerKey = { q1: { correct: ['A'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'answer-key-leak')).toBe(true);
  });

  it('Points en questions es válido (no leak)', () => {
    const content = {
      questions: [{ code: 'q1', type: 'short_text', text: 'Q?', points: 10 }],
    };
    const answerKey = { q1: { correct: ['A'], points: 10 } };

    const result = validateAssessmentForPublish({ content, answerKey });
    // points in questions is allowed
    expect(
      result.errors.some((e) => e.rule === 'answer-key-leak' && e.path?.includes('points'))
    ).toBe(false);
  });
});

// ─────────────────────────── Auditoría 15/9 — correcciones ───────────────────────────

describe('auditoría 15/9 - gráfico con tabla cerca (:115)', () => {
  const id = 'cm12345678901234567890123';
  const assets = new Map([[id, createAsset({ id })]]);
  const longAlt = 'A'.repeat(251);

  it('tabla GFM en los 3 bloques siguientes → sin warning', () => {
    const md = `![${longAlt}](asset:${id})\n\nTexto intermedio.\n\n| Año | Valor |\n|---|---|\n| 2024 | 10 |`;
    const result = validateLesson(md, assets);
    expect(result.warnings.some((w) => w.rule === 'chart-needs-data-table')).toBe(false);
  });

  it('tabla GFM más allá de 3 bloques → warning', () => {
    const md = `![${longAlt}](asset:${id})\n\nUno.\n\nDos.\n\nTres.\n\n| Año | Valor |\n|---|---|\n| 2024 | 10 |`;
    const result = validateLesson(md, assets);
    expect(result.warnings.some((w) => w.rule === 'chart-needs-data-table')).toBe(true);
  });
});

describe('auditoría 15/9 - encabezados (:60, :120)', () => {
  it('el primer encabezado del cuerpo debe ser h2: empezar en h3 es salto de nivel', () => {
    const md = '### Empieza en h3\n\nTexto.';
    const result = validateLesson(md);
    expect(result.errors.some((e) => e.rule === 'heading-level-skip')).toBe(true);
  });

  it('empezar en h2 → ok', () => {
    const result = validateLesson('## Empieza en h2\n\nTexto.');
    expect(result.errors.some((e) => e.rule === 'heading-level-skip')).toBe(false);
  });
});

describe('subtítulos: aviso, no bloqueo (19/9)', () => {
  // Del 18/9 al 19/9 esta regla fue error sin excepción. El 19/9 Jhonny decidió que un video
  // sin subtítulos revisados ni transcripción se publica, y que la regla avise sin bloquear.
  // El aviso sigue existiendo: lo que se prueba aquí es que no desaparece al rebajarlo.
  it('un video sin subtítulos revisados ni transcripción publica, y el aviso sigue ahí', () => {
    const id = 'cm12345678901234567890123';
    const assets = new Map([
      [id, createAsset({ id, kind: 'VIDEO', captionsSource: 'AUTO', transcriptPath: null })],
    ]);

    const result = validateLesson(`::video{asset="${id}"}`, assets);

    expect(result.ok).toBe(true);
    expect(result.errors.some((e) => e.rule === 'video-needs-captions')).toBe(false);
    expect(result.warnings.some((w) => w.rule === 'video-needs-captions')).toBe(true);
  });
});

describe('auditoría 15/9 - imagen externa (contrato :54)', () => {
  it('![alt](https://…) en una lección es error image-not-asset', () => {
    const result = validateLesson('![Una foto](https://ejemplo.com/foto.png)');
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.rule === 'image-not-asset')).toBe(true);
  });

  it('![alt](https://…) en un enunciado también es error, con path', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: '![Una foto](https://ejemplo.com/foto.png)',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };
    const result = validateAssessmentForPublish({ content, answerKey });
    expect(
      result.errors.some((e) => e.rule === 'image-not-asset' && e.path === 'questions.q1.text')
    ).toBe(true);
  });
});

describe('auditoría 15/9 - alt de imágenes en enunciados con las mismas reglas (:128)', () => {
  it('alt igual al nombre de archivo en un enunciado → statement-images-alt', () => {
    const content = {
      questions: [
        {
          code: 'q1',
          type: 'single_choice',
          text: '![foto.jpg](asset:cm12345678901234567890123)',
          options: [
            { code: 'a', text: 'A' },
            { code: 'b', text: 'B' },
          ],
          points: 10,
        },
      ],
    };
    const answerKey = { q1: { correct: 'a', points: 10 } };
    const result = validateAssessmentForPublish({ content, answerKey });
    expect(result.errors.some((e) => e.rule === 'statement-images-alt')).toBe(true);
  });
});
