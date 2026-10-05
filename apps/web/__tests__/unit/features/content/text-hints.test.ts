/**
 * Las pistas del editor de temas (4/10): minutos sugeridos y títulos en mayúsculas.
 */

import {
  countWords,
  shoutingHeadings,
  suggestedMinutes,
} from '@/features/content/editor/text-hints';

describe('countWords', () => {
  it('cuenta lo que se lee y no las marcas, URLs, directivas ni fórmulas', () => {
    const markdown = [
      '## Un título',
      '',
      'Un [enlace](https://x.test/largo) y **negrita**.',
      '',
      '::video{asset="cm1abcdefghijklmnopqrstuv"}',
      '![Una imagen](asset:cm1abcdefghijklmnopqrstuv)',
      '',
      '- Uno',
      '- Dos $x^2 + y$',
    ].join('\n');

    expect(countWords(markdown)).toBe(8);
  });

  it('sin texto, cero', () => {
    expect(countWords('')).toBe(0);
  });
});

describe('suggestedMinutes', () => {
  it('redondea a 150 palabras por minuto y nunca baja de uno', () => {
    expect(suggestedMinutes(430)).toBe(3);
    expect(suggestedMinutes(20)).toBe(1);
    expect(suggestedMinutes(0)).toBeNull();
  });
});

describe('shoutingHeadings', () => {
  it('encuentra los títulos y las líneas en negrita en mayúsculas', () => {
    const markdown = [
      '## ¿CÓMO RECONOCER LO QUE SENTIMOS?',
      '**APRENDER ES AVANZAR**',
      '## Principales emociones',
      '### SENA',
      'UN PÁRRAFO EN MAYÚSCULAS NO ES UN TÍTULO',
    ].join('\n');

    expect(shoutingHeadings(markdown)).toEqual([
      '¿CÓMO RECONOCER LO QUE SENTIMOS?',
      'APRENDER ES AVANZAR',
    ]);
  });
});
