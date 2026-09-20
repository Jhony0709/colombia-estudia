/**
 * Tests for blocks: el modelo del editor de bloques.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:60-75.
 *
 * Lo que se prueba es la promesa del modelo: recortar, no reconstruir. Abrir y cerrar sin
 * tocar nada devuelve el Markdown byte a byte.
 */

import {
  blockIndexForLine,
  blockStartLines,
  blocksToMarkdown,
  markdownToBlocks,
  vimeoIdFrom,
  wrapSelection,
} from './blocks';

const FIXTURE = `## De qué se trata

En este tema aprenderás sobre **inteligencia financiera** de la mano de *Luisa Gómez*.

::video{asset="cmu6vh07t0021tvg44csw1duz"}

Texto con \`código\` y :lang[the text]{lang="en"} y $x^2$ en línea.

- uno
- dos con **negrita *y cursiva* dentro**
  - anidado

1. primero
2. segundo

- [ ] pendiente
- [x] hecho

> Una cita
> de dos líneas

![Un cuadro de gastos](asset:abc123)

| Columna | Otra |
| --- | --- |
| a | b |

$$
E = mc^2
$$

\`\`\`js
const a = 1;
\`\`\`

---

Fin.
`;

describe('blocks', () => {
  it('la ida y vuelta es exacta, byte a byte', () => {
    expect(blocksToMarkdown(markdownToBlocks(FIXTURE))).toBe(FIXTURE);
  });

  it('clasifica todo lo que el contrato admite', () => {
    expect(markdownToBlocks(FIXTURE).map((block) => block.kind)).toEqual([
      'heading',
      'text',
      'media',
      'text',
      'list',
      'list',
      'list',
      'quote',
      'image',
      'table',
      'math',
      'code',
      'rule',
      'text',
    ]);
  });

  it('un vídeo es un bloque de medio con su asset, y vuelve igual', () => {
    const [block] = markdownToBlocks('::video{asset="abc"}');

    expect(block).toMatchObject({ kind: 'media', media: 'video', assetId: 'abc' });
    expect(blocksToMarkdown(markdownToBlocks('::video{asset="abc"}'))).toBe(
      '::video{asset="abc"}\n'
    );
  });

  it('el aviso de una línea lleva a su bloque', () => {
    const blocks = markdownToBlocks(FIXTURE);
    const md = blocksToMarkdown(blocks).split('\n');

    for (const line of blockStartLines(blocks)) {
      expect(md[line - 1]?.trim()).not.toBe('');
    }
    expect(blockIndexForLine(blocks, 5)).toBe(2);
    expect(blockIndexForLine(blocks, 1)).toBe(0);
  });

  it('el documento vacío es un párrafo vacío, y los bloques vacíos no se escriben', () => {
    expect(markdownToBlocks('').map((block) => block.kind)).toEqual(['text']);
    expect(blocksToMarkdown(markdownToBlocks(''))).toBe('');
    expect(
      blocksToMarkdown([
        { id: 'a', kind: 'text', markdown: 'Hola' },
        { id: 'b', kind: 'text', markdown: '   ' },
        { id: 'c', kind: 'heading', level: 2, text: 'Fin' },
      ])
    ).toBe('Hola\n\n## Fin\n');
  });

  it('lo que no reconoce lo conserva tal cual', () => {
    const md = '::otra{x=1}\n\n<div>hi</div>\n';

    expect(markdownToBlocks(md).map((block) => block.kind)).toEqual(['raw', 'raw']);
    expect(blocksToMarkdown(markdownToBlocks(md))).toBe(md);
  });

  it('reconoce una dirección de Vimeo solo cuando es solo eso', () => {
    expect(vimeoIdFrom('https://vimeo.com/737436102')).toBe('737436102');
    expect(vimeoIdFrom('https://player.vimeo.com/video/737436102?h=abc')).toBe('737436102');
    expect(vimeoIdFrom('737436102')).toBe('737436102');
    expect(vimeoIdFrom('mira https://vimeo.com/737436102 aquí')).toBeNull();
  });

  it('envuelve la selección y deja el cursor sobre lo envuelto', () => {
    expect(wrapSelection('hola mundo', 5, 10, '**', '**')).toEqual({
      text: 'hola **mundo**',
      start: 7,
      end: 12,
    });
  });
});
