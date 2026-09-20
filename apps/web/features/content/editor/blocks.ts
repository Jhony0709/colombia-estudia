/**
 * El modelo del editor de bloques: un tema es una lista de bloques, y cada bloque sabe
 * escribirse en Markdown.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:60-75 (lo que el Markdown
 * admite), PRODUCT_DECISIONS.md (19/9, editor propio de bloques).
 *
 * **Se recorta, no se reconstruye.** `remark-parse` —el mismo del render— dice dónde empieza y
 * acaba cada bloque de primer nivel, y el texto del bloque es ESE trozo del Markdown original.
 * Un párrafo que no se toca vuelve byte a byte; no hay serializador que normalice comillas ni
 * viñetas. Solo los bloques con forma propia (encabezado, cita, código, fórmula, medio,
 * imagen) se reescriben, y siempre igual.
 *
 * Es código puro: sin React. Recibe y devuelve texto y objetos, y se prueba con `node`.
 */

import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/* ─────────────────────────── Los bloques ─────────────────────────── */

export type MediaKind = 'video' | 'audio' | 'pdf';

export type Block =
  | { id: string; kind: 'text'; markdown: string }
  | { id: string; kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { id: string; kind: 'list'; markdown: string }
  | { id: string; kind: 'quote'; text: string }
  | { id: string; kind: 'code'; language: string; code: string }
  | { id: string; kind: 'table'; markdown: string }
  | { id: string; kind: 'math'; latex: string }
  | { id: string; kind: 'media'; media: MediaKind; assetId: string }
  | { id: string; kind: 'image'; alt: string; assetId: string }
  | { id: string; kind: 'rule' }
  /** Lo que no es ninguno de los anteriores: se enseña tal cual para que no se pierda. */
  | { id: string; kind: 'raw'; markdown: string };

export type BlockKind = Block['kind'];

const MEDIA_KINDS: readonly MediaKind[] = ['video', 'audio', 'pdf'];

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

/**
 * Ids estables mientras dura la sesión de edición: React los necesita para no perder el foco
 * ni el estado de un campo cuando se mueve o se inserta otro bloque. No van al Markdown.
 */
let nextId = 1;
export function newId(): string {
  nextId += 1;
  return `b${nextId}`;
}

/* ─────────────────────────── remark ─────────────────────────── */

/** Lo justo del árbol de mdast para recortar y clasificar; sin depender de `@types/mdast`. */
interface MdNode {
  type: string;
  position?: { start: { offset: number; line: number }; end: { offset: number } };
  children?: MdNode[];
  depth?: number;
  lang?: string | null;
  value?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined> | null;
  url?: string;
  alt?: string | null;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective);

export function parseTopLevel(markdown: string): MdNode[] {
  const root = parser.parse(markdown) as unknown as MdNode;
  return root.children ?? [];
}

/* ─────────────────────────── Markdown → bloques ─────────────────────────── */

export function markdownToBlocks(markdown: string): Block[] {
  const blocks = parseTopLevel(markdown).map((node) => toBlock(node, markdown));
  return blocks.length > 0 ? blocks : [{ id: newId(), kind: 'text', markdown: '' }];
}

function slice(node: MdNode, markdown: string): string {
  if (!node.position) return '';
  return markdown.slice(node.position.start.offset, node.position.end.offset);
}

function toBlock(node: MdNode, markdown: string): Block {
  const id = newId();
  const raw = slice(node, markdown);

  switch (node.type) {
    case 'paragraph': {
      // Un párrafo que es solo una imagen es un bloque de imagen.
      const only = node.children?.length === 1 ? node.children[0] : undefined;
      if (only?.type === 'image') {
        const match = /^asset:(.+)$/.exec(only.url ?? '');
        if (match) return { id, kind: 'image', alt: only.alt ?? '', assetId: match[1]! };
      }
      return { id, kind: 'text', markdown: raw };
    }
    case 'heading': {
      const level = (node.depth ?? 2) as 2 | 3 | 4;
      return {
        id,
        kind: 'heading',
        level: level < 2 ? 2 : level > 4 ? 4 : level,
        text: raw.replace(/^#{1,6}\s*/, '').replace(/\s*#+\s*$/, ''),
      };
    }
    case 'list':
      return { id, kind: 'list', markdown: raw };
    case 'blockquote':
      return {
        id,
        kind: 'quote',
        text: raw
          .split('\n')
          .map((line) => line.replace(/^>\s?/, ''))
          .join('\n'),
      };
    case 'code':
      return { id, kind: 'code', language: node.lang ?? '', code: node.value ?? '' };
    case 'table':
      return { id, kind: 'table', markdown: raw };
    case 'math':
      return { id, kind: 'math', latex: node.value ?? '' };
    case 'thematicBreak':
      return { id, kind: 'rule' };
    case 'leafDirective':
    case 'containerDirective': {
      const name = node.name ?? '';
      if (isMediaKind(name)) {
        return { id, kind: 'media', media: name, assetId: node.attributes?.asset ?? '' };
      }
      return { id, kind: 'raw', markdown: raw };
    }
    default:
      return { id, kind: 'raw', markdown: raw };
  }
}

/* ─────────────────────────── bloques → Markdown ─────────────────────────── */

export function blockToMarkdown(block: Block): string {
  switch (block.kind) {
    case 'text':
    case 'list':
    case 'table':
    case 'raw':
      return block.markdown.replace(/\s+$/, '');
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text.trim()}`;
    case 'quote':
      return block.text
        .replace(/\s+$/, '')
        .split('\n')
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n');
    case 'code':
      return `\`\`\`${block.language.trim()}\n${block.code.replace(/\s+$/, '')}\n\`\`\``;
    case 'math':
      return `$$\n${block.latex.trim()}\n$$`;
    case 'media':
      return `::${block.media}{asset="${block.assetId.trim()}"}`;
    case 'image':
      return `![${block.alt.trim()}](asset:${block.assetId.trim()})`;
    case 'rule':
      return '---';
  }
}

/** Un bloque vacío no se escribe: un párrafo en blanco entre dos no es contenido. */
export function isEmptyBlock(block: Block): boolean {
  switch (block.kind) {
    case 'text':
    case 'list':
    case 'table':
    case 'raw':
      return block.markdown.trim() === '';
    case 'heading':
      return block.text.trim() === '';
    case 'quote':
      return block.text.trim() === '';
    case 'code':
      return block.code.trim() === '';
    case 'math':
      return block.latex.trim() === '';
    case 'media':
    case 'image':
      return block.assetId.trim() === '';
    case 'rule':
      return false;
  }
}

export function blocksToMarkdown(blocks: Block[]): string {
  const parts = blocks.filter((block) => !isEmptyBlock(block)).map(blockToMarkdown);
  return parts.length === 0 ? '' : `${parts.join('\n\n')}\n`;
}

/**
 * La línea del Markdown en la que empieza cada bloque, en el mismo orden. Los avisos vienen
 * con la línea del Markdown guardado (`publish-validation`), y el editor no tiene líneas,
 * tiene bloques: esto es lo que permite llevar el foco al bloque de un aviso. Un bloque vacío
 * no ocupa línea, así que apunta a la del siguiente.
 */
export function blockStartLines(blocks: Block[]): number[] {
  const lines: number[] = [];
  let line = 1;
  for (const block of blocks) {
    lines.push(line);
    if (isEmptyBlock(block)) continue;
    line += blockToMarkdown(block).split('\n').length + 1;
  }
  return lines;
}

export function blockIndexForLine(blocks: Block[], line: number): number {
  const starts = blockStartLines(blocks);
  let index = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i]! <= line && !isEmptyBlock(blocks[i]!)) index = i;
  }
  return index;
}

/* ─────────────────────────── Ayudas para la interfaz ─────────────────────────── */

/** Una dirección de Vimeo, el código de inserción, o solo el número. Devuelve el id del vídeo. */
export function vimeoIdFrom(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '' || /\s/.test(trimmed)) return null;
  const match =
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d{6,})/.exec(trimmed) ??
    /^(\d{6,})$/.exec(trimmed);
  return match ? match[1]! : null;
}

/** Un bloque nuevo de cada tipo, vacío. */
export function emptyBlock(kind: Exclude<BlockKind, 'media' | 'image'>): Block {
  const id = newId();
  switch (kind) {
    case 'text':
      return { id, kind: 'text', markdown: '' };
    case 'heading':
      return { id, kind: 'heading', level: 2, text: '' };
    case 'list':
      return { id, kind: 'list', markdown: '- ' };
    case 'quote':
      return { id, kind: 'quote', text: '' };
    case 'code':
      return { id, kind: 'code', language: '', code: '' };
    case 'table':
      return { id, kind: 'table', markdown: '| Columna | Columna |\n| --- | --- |\n|  |  |' };
    case 'math':
      return { id, kind: 'math', latex: '' };
    case 'rule':
      return { id, kind: 'rule' };
    case 'raw':
      return { id, kind: 'raw', markdown: '' };
  }
}

/**
 * Envuelve la selección de un campo con marcas de Markdown en línea. Devuelve el texto nuevo
 * y dónde dejar el cursor: sobre lo envuelto, para que otra pulsación siga aplicándose a lo
 * mismo. Si no hay selección, envuelve un hueco y deja el cursor dentro.
 */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string
): { text: string; start: number; end: number } {
  const selected = text.slice(start, end);
  const next = `${text.slice(0, start)}${before}${selected}${after}${text.slice(end)}`;
  return { text: next, start: start + before.length, end: start + before.length + selected.length };
}
