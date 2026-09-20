/**
 * Del documento del editor al Markdown que se guarda.
 * SSOT: packages/types/src/content.ts.
 *
 * **Esta es la dirección peligrosa.** Es la que escribe encima del trabajo de alguien: si
 * pierde algo, lo pierde para siempre y sin avisar. Por eso se escribe a mano, sin
 * dependencias, y se prueba contra el validador de verdad: la única prueba que vale es que
 * `parseLessonMarkdown` acepte lo que sale de aquí, no que a mí me parezca correcto.
 *
 * Dos cosas que no son adorno:
 *
 * 1. **Se escapa `<`.** `content.ts:232` rechaza HTML crudo. Alguien que escriba «si a < b»
 *    en un párrafo produciría, sin escape, un tema que no publica y un mensaje sobre HTML
 *    que no explica nada a quien solo escribió una desigualdad.
 * 2. **Se escapa lo que abre sintaxis al principio de línea** (`#`, `-`, `>`, `1.`). Un
 *    párrafo que empieza por «- y entonces…» se convertiría en una lista al releerlo.
 */

import type { Block, Inline, LessonDoc, ListItem } from './document';

/**
 * Caracteres que cambian de significado en cualquier posición.
 *
 * `$` entra porque `remark-math` lo trata como delimitador: un precio escrito «$20» y otro
 * más abajo se convertirían en una fórmula con el texto de en medio dentro.
 */
const INLINE_ESCAPE = /([\\`*_[\]<>$])/g;

/**
 * Y estos solo cuando abren la línea.
 *
 * El punto de «1.» se escapa **detrás del número**, no delante. `\1.` no es un escape válido
 * —CommonMark solo escapa puntuación ASCII— y se le aparecería al estudiante tal cual, con la
 * barra invertida incluida. Lo que desactiva la lista es `1\.`.
 */
const LINE_START_MARKER = /^(\s*)([#>+\-*])(\s)/;
const LINE_START_ORDERED = /^(\s*)(\d+)([.)])(\s)/;

function escapeText(value: string): string {
  return value
    .replace(INLINE_ESCAPE, '\\$1')
    .split('\n')
    .map((line) =>
      line.replace(LINE_START_MARKER, '$1\\$2$3').replace(LINE_START_ORDERED, '$1$2\\$3$4')
    )
    .join('\n');
}

function inline(nodes: Inline[]): string {
  return nodes.map(inlineOne).join('');
}

function inlineOne(node: Inline): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value);
    case 'strong':
      return `**${inline(node.children)}**`;
    case 'emphasis':
      return `*${inline(node.children)}*`;
    case 'delete':
      return `~~${inline(node.children)}~~`;
    case 'inlineCode':
      // Si el texto ya lleva acentos graves, la valla crece hasta poder contenerlo.
      return fenceCode(node.value, '`');
    case 'inlineMath':
      return `$${node.value}$`;
    case 'link':
      return `[${inline(node.children)}](${node.url})`;
    case 'image':
      return `![${escapeText(node.alt)}](asset:${node.assetId})`;
    case 'lang':
      // La forma explícita y no `{en}`: `{lang=en}` no depende de cómo se interprete un
      // atributo sin valor. `content.ts:363-371` acepta las dos.
      return `:lang[${inline(node.children)}]{lang=${node.language}}`;
  }
}

/** Una valla de acentos graves más larga que la racha más larga que haya dentro. */
function fenceCode(value: string, char: string): string {
  let longest = 0;
  let run = 0;
  for (const c of value) {
    run = c === char ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  const fence = char.repeat(longest + 1);
  const pad = value.startsWith(char) || value.endsWith(char) ? ' ' : '';
  return `${fence}${pad}${value}${pad}${fence}`;
}

function listItem(item: ListItem, ordered: boolean, index: number, start: number): string {
  const marker = ordered ? `${start + index}. ` : '- ';
  const box = item.checked === null ? '' : item.checked ? '[x] ' : '[ ] ';
  const body = blocks(item.children);
  const indent = ' '.repeat(marker.length);

  // La primera línea lleva el marcador; las demás se sangran a su ancho, que es lo que
  // mantiene dentro del punto un párrafo o una sublista.
  return body
    .split('\n')
    .map((line, i) => (i === 0 ? `${marker}${box}${line}` : line === '' ? '' : `${indent}${line}`))
    .join('\n');
}

function tableRow(cells: Inline[][]): string {
  // La barra dentro de una celda parte la fila; escaparla es la única forma de escribirla.
  return `| ${cells.map((cell) => inline(cell).replace(/\|/g, '\\|')).join(' | ')} |`;
}

function tableDivider(align: Array<'left' | 'right' | 'center' | null>): string {
  const cell = (a: 'left' | 'right' | 'center' | null): string => {
    if (a === 'left') return ':---';
    if (a === 'right') return '---:';
    if (a === 'center') return ':---:';
    return '---';
  };
  return `| ${align.map(cell).join(' | ')} |`;
}

function blockOne(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.depth)} ${inline(block.children)}`;
    case 'paragraph':
      return inline(block.children);
    case 'blockquote':
      return blocks(block.children)
        .split('\n')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n');
    case 'list': {
      const start = block.start ?? 1;
      return block.items
        .map((item, index) => listItem(item, block.ordered, index, start))
        .join('\n');
    }
    case 'code': {
      // La valla crece por encima de la racha de acentos más larga que empiece una línea
      // dentro, o el bloque se cerraría antes de tiempo.
      const longest = Math.max(
        0,
        ...block.value.split('\n').map((line) => (/^`+/.exec(line)?.[0] ?? '').length)
      );
      const bar = '`'.repeat(Math.max(3, longest + 1));
      return `${bar}${block.lang ?? ''}\n${block.value}\n${bar}`;
    }
    case 'math':
      return `$$\n${block.value}\n$$`;
    case 'table':
      return [
        tableRow(block.header),
        tableDivider(block.align),
        ...block.rows.map((row) => tableRow(row)),
      ].join('\n');
    case 'thematicBreak':
      return '---';
    case 'asset':
      return `::${block.kind}{asset="${block.assetId}"}`;
    case 'image':
      return `![${escapeText(block.alt)}](asset:${block.assetId})`;
  }
}

/** Los bloques, separados por una línea en blanco, que es lo que los separa en Markdown. */
function blocks(list: Block[]): string {
  return list.map(blockOne).join('\n\n');
}

export function docToMarkdown(doc: LessonDoc): string {
  // Un párrafo vacío al final es el cursor de quien estaba escribiendo, no contenido.
  const meaningful = doc.blocks.filter(
    (block) => !(block.type === 'paragraph' && inline(block.children).trim() === '')
  );

  const text = blocks(meaningful).replace(/[ \t]+$/gm, '');
  return text === '' ? '' : `${text}\n`;
}
