/**
 * Renderiza el Markdown de un tema a HTML seguro.
 * SSOT: plan/07-contenido-y-migracion.md:12-18 (§1), reference/04-business-logic/contenido-y-evaluaciones.md.
 *
 * Es la otra mitad de `content.ts`: aquel valida, este muestra. Y es la pieza de seguridad
 * del contenido — todo lo que un estudiante ve del programa pasa por aquí.
 *
 * La cadena, en orden y sin atajos:
 *
 *   remark-parse → gfm → math → directive
 *     → nuestras directivas se convierten en HTML acotado
 *     → remark-rehype **sin `allowDangerousHtml`**
 *     → rehype-katex (salida MathML)
 *     → rehype-sanitize con esquema propio
 *     → rehype-stringify
 *
 * `allowDangerousHtml` ausente no es un olvido: es lo que hace que el HTML crudo escrito en
 * el Markdown se quede en texto y no en etiquetas. El `sanitize` de después es el cinturón.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';
import type { Node, Parent } from 'unist';

import type { LessonAssetInfo } from './content';
import { CALLOUT_TITLES, isCalloutKind } from './callouts';

/** Lo que el render necesita saber de cada asset para poder pintarlo. */
export interface RenderAsset {
  id: string;
  kind: LessonAssetInfo['kind'];
  /** URL firmada de lectura, o el id de Vimeo para los videos. */
  src: string;
  altText: string | null;
  /** Pista de subtítulos ya resuelta, si la hay. */
  captionsSrc?: string | null;
  title?: string | null;
}

export interface RenderOptions {
  /** Idioma del contenedor, del `Lesson.language`. */
  language?: string;
  /**
   * El título del tema (4/10): si el primer bloque lo repite —un título o una línea en
   * negrita, como traen los documentos importados—, se quita; el `h1` de la página ya lo dice.
   */
  title?: string;
}

/** Una sección del tema (`##`) para el índice «En este tema»: `id` es el del HTML final. */
export interface LessonOutlineItem {
  id: string;
  text: string;
}

/** El prefijo que `rehype-sanitize` pone a todo `id` (su `clobberPrefix` por defecto). */
const ID_PREFIX = 'user-content-';

interface DirectiveNode extends Node {
  type: 'leafDirective' | 'textDirective' | 'containerDirective';
  name: string;
  attributes?: Record<string, string>;
  children?: Node[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    hChildren?: unknown[];
  };
}

const text = (value: string) => ({ type: 'text', value });

const el = (tagName: string, properties: Record<string, unknown>, children: unknown[] = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});

/**
 * Convierte nuestras directivas en HTML acotado **antes** de rehype.
 *
 * Aquí es donde `::video{asset=…}` se vuelve un `<figure>` con su `<iframe>` y su enlace de
 * respaldo. Lo importante: lo que sale de aquí vuelve a pasar por `sanitize`, así que ni
 * siquiera este código puede colar un atributo que el esquema no permita.
 */
function directivesToHtml(assets: Map<string, RenderAsset>) {
  return () => (tree: Root) => {
    visit(tree, (node: Node) => {
      if (
        node.type !== 'leafDirective' &&
        node.type !== 'textDirective' &&
        node.type !== 'containerDirective'
      ) {
        return;
      }

      const directive = node as DirectiveNode;
      const name = directive.name;

      if (name === 'lang') {
        // Las dos formas que acepta el parser: `:lang[texto]{en}` deja el código como clave
        // con valor vacío, y `:lang[texto]{lang=en}` como valor de `lang`.
        const attrs = directive.attributes ?? {};
        const bare = Object.keys(attrs).find((key) => attrs[key] === '' || attrs[key] == null);
        const value = bare ?? attrs.lang ?? '';
        directive.data = {
          hName: 'span',
          hProperties: value === '' ? {} : { lang: value },
        };
        return;
      }

      // Un callout (27/9): `<aside class="callout callout-<kind>">` con su título como primer
      // párrafo. El cuerpo sigue siendo Markdown y pasa por el mismo saneado que todo.
      if (name === 'callout' && node.type === 'containerDirective') {
        const kind = directive.attributes?.kind ?? 'note';
        const safeKind = isCalloutKind(kind) ? kind : 'note';
        const title = directive.attributes?.title?.trim() || CALLOUT_TITLES[safeKind];
        directive.data = {
          hName: 'aside',
          hProperties: { className: ['callout', `callout-${safeKind}`] },
        };
        (directive as unknown as { children: unknown[] }).children.unshift({
          type: 'paragraph',
          data: { hProperties: { className: ['callout-title'] } },
          children: [{ type: 'text', value: title }],
        });
        return;
      }

      // Solo `video`, `audio` y `pdf` llevan asset. Cualquier otra cosa es una directiva que
      // el contrato no conoce: la validación impide publicarla, pero la vista previa de un
      // borrador sí la ve, y decir "recurso no disponible" sería mentir sobre qué pasa.
      if (name !== 'video' && name !== 'audio' && name !== 'pdf') {
        directive.data = {
          hName: 'p',
          hProperties: { className: ['contenido-invalido'], role: 'note' },
          hChildren: [text(`Directiva no reconocida: ::${name}`)],
        };
        return;
      }

      const assetId = directive.attributes?.asset ?? '';
      const asset = assets.get(assetId);

      if (!asset) {
        // Un asset que no está no se pinta como un hueco silencioso: se dice.
        directive.data = {
          hName: 'p',
          hProperties: { className: ['contenido-faltante'], role: 'note' },
          hChildren: [text('Este recurso no está disponible.')],
        };
        return;
      }

      if (name === 'video') {
        directive.data = {
          hName: 'figure',
          hProperties: { className: ['media', 'media-video'] },
          hChildren: [
            el('iframe', {
              src: asset.src,
              title: asset.title ?? 'Video del tema',
              allowFullScreen: true,
              loading: 'lazy',
            }),
          ],
        };
        return;
      }

      if (name === 'audio') {
        directive.data = {
          hName: 'figure',
          hProperties: { className: ['media', 'media-audio'] },
          hChildren: [
            el('audio', { src: asset.src, controls: true }),
            ...(asset.altText ? [el('figcaption', {}, [text(asset.altText)])] : []),
          ],
        };
        return;
      }

      if (name === 'pdf') {
        directive.data = {
          hName: 'p',
          hProperties: { className: ['media', 'media-pdf'] },
          hChildren: [
            el('a', { href: asset.src, download: true }, [
              text(asset.altText ?? 'Descargar el documento'),
            ]),
          ],
        };
      }
    });
  };
}

/** El texto de un nodo mdast o hast, sin marcas. */
function plainText(node: Node): string {
  const value = (node as { value?: unknown }).value;
  if (typeof value === 'string') return value;
  const children = (node as Partial<Parent>).children;
  return children ? children.map(plainText).join('') : '';
}

// «Taller 1.», «Actividad práctica 2.»: el prefijo de numeración que el título lleva y el
// primer bloque del documento importado no.
const TITLE_PREFIX =
  /^(?:taller|actividad(?:\s+pr[aá]ctica)?|tema|lecci[oó]n|unidad|m[oó]dulo)\s*\d+\s*[.:)\-–]\s*/iu;

const comparable = (value: string) =>
  value
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** ¿Repite este texto el título del tema, con o sin su numeración y sin mirar mayúsculas? */
export function repeatsTitle(text: string, title: string): boolean {
  const block = comparable(text);
  if (block === '') return false;
  return block === comparable(title) || block === comparable(title.replace(TITLE_PREFIX, ''));
}

/** Quita el primer bloque si es un título o una línea en negrita que repite el del tema. */
function dropLeadingTitle(title: string | undefined) {
  return () => (tree: Root) => {
    const first = tree.children[0];
    if (!title || !first) return;
    const titleLike =
      first.type === 'heading' ||
      (first.type === 'paragraph' &&
        first.children.length === 1 &&
        first.children[0]?.type === 'strong');
    if (titleLike && repeatsTitle(plainText(first), title)) tree.children.shift();
  };
}

interface HastElement extends Parent {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
}

const isElement = (node: Node | undefined, tagName: string): node is HastElement =>
  node?.type === 'element' && (node as HastElement).tagName === tagName;

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Un `id` para cada `h2` del tema (4/10), para enlazar las secciones desde el índice. Solo los
 * del primer nivel del documento: un título dentro de un recuadro no es una sección.
 */
function sectionIds(outline: LessonOutlineItem[]) {
  return () => (tree: Node) => {
    const used = new Map<string, number>();
    for (const node of (tree as Parent).children) {
      if (!isElement(node, 'h2')) continue;
      const label = plainText(node).trim();
      const base = slug(label) || 'seccion';
      const seen = (used.get(base) ?? 0) + 1;
      used.set(base, seen);
      const id = seen === 1 ? base : `${base}-${seen}`;
      node.properties.id = id;
      outline.push({ id: `${ID_PREFIX}${id}`, text: label });
    }
  };
}

/** Cada tabla en su marco (4/10): la tabla ocupa el ancho y, si no cabe, se desplaza el marco. */
function wrapTables() {
  return () => (tree: Node) => {
    visit(tree, 'element', (node: Node, index?: number, parent?: Parent) => {
      if (!isElement(node, 'table') || !parent || index === undefined) return;
      if (isElement(parent, 'div')) return;
      parent.children[index] = el('div', { className: ['tabla'] }, [node]) as unknown as Node;
    });
  };
}

/**
 * Una imagen sola en su línea y con título (`![alt](asset:id "Pie")`) sale como figura con
 * pie (4/10). Todas cargan en diferido.
 */
function imageFigures() {
  return () => (tree: Node) => {
    visit(tree, 'element', (node: Node, index?: number, parent?: Parent) => {
      if (isElement(node, 'img')) {
        node.properties.loading = 'lazy';
        return;
      }
      if (!isElement(node, 'p') || !parent || index === undefined) return;
      const content = node.children.filter(
        (child) => plainText(child).trim() !== '' || child.type !== 'text'
      );
      const image = content[0];
      if (content.length !== 1 || !isElement(image, 'img')) return;
      const caption =
        typeof image.properties.title === 'string' ? image.properties.title.trim() : '';
      if (caption === '') return;
      delete image.properties.title;
      parent.children[index] = el('figure', { className: ['figura'] }, [
        image,
        el('figcaption', {}, [text(caption)]),
      ]) as unknown as Node;
    });
  };
}

/** Resuelve `asset:<id>` de las imágenes a su URL, y pone el `alt` guardado si falta. */
function resolveImages(assets: Map<string, RenderAsset>) {
  return () => (tree: Root) => {
    visit(tree, 'image', (node: { url: string; alt?: string | null }) => {
      const match = node.url.match(/^asset:(.+)$/);

      // El contrato solo admite `![alt](asset:<id>)`. Una URL externa no se pinta: la
      // validación ya impide publicarla, y pintarla en la vista previa pediría la imagen a
      // un tercero desde el navegador de quien escribe, enseñando algo que nunca se
      // publicará.
      if (!match?.[1]) {
        // Una URL vacía es el marcador que el editor pone mientras sube la imagen pegada
        // (`![Subiendo x…]()`, 27/9): su `alt` ya dice lo que pasa y se respeta. El consejo es
        // para la URL externa, que es la que hay que cambiar.
        const isPlaceholder = node.url.trim() === '' && !!node.alt && node.alt.trim() !== '';
        node.url = '';
        if (!isPlaceholder) {
          node.alt = 'Las imágenes se suben a la biblioteca y se citan como asset:<id>';
        }
        return;
      }

      const asset = assets.get(match[1]);
      if (!asset) {
        node.url = '';
        node.alt = 'Imagen no disponible';
        return;
      }

      node.url = asset.src;
      if (!node.alt || node.alt.trim() === '') node.alt = asset.altText ?? '';
    });
  };
}

/**
 * El esquema de saneado.
 *
 * Parte del de `hast-util-sanitize` y le añade **solo** lo que el contrato necesita: MathML
 * (que KaTeX produce), los medios acotados de arriba, y los atributos de tabla de GFM.
 *
 * Lo que **no** se añade, aunque parezca inofensivo: `style`, `class` libre, `id` arbitrario,
 * `srcset`, `on*`. Un esquema que crece "porque hacía falta para una cosa" deja de ser un
 * esquema.
 */
const MATHML_TAGS = [
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'mspace',
  'msqrt',
  'mroot',
  'mstyle',
  'merror',
  'mpadded',
  'mphantom',
  'mfenced',
  'mfrac',
  'msub',
  'msup',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mmultiscripts',
  'mtable',
  'mtr',
  'mtd',
  'mlabeledtr',
  'maction',
];

// El tipo va escrito y no inferido: sin él, TypeScript intenta nombrar el tipo a través de
// `hast-util-sanitize`, que es una dependencia transitiva y no está declarada aquí (TS2742).
export const lessonSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'figure',
    'figcaption',
    'aside',
    'iframe',
    'audio',
    'source',
    'track',
    ...MATHML_TAGS,
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'lang', 'dir'],
    iframe: ['src', 'title', 'allowFullScreen', 'loading'],
    audio: ['src', 'controls'],
    track: ['src', 'kind', 'srcLang', 'label', 'default'],
    a: [...(defaultSchema.attributes?.a ?? []), 'download'],
    // Solo el marco de las tablas (`wrapTables`): el autor no escribe HTML.
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'tabla']],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
    figure: ['className'],
    aside: ['className'],
    p: ['className', 'role'],
    // El genérico va PRIMERO: si fuera después pisaría las entradas de `math` y
    // `annotation` de abajo, y `display="block"` y `encoding` se perderían por el camino.
    ...Object.fromEntries(MATHML_TAGS.map((tag) => [tag, ['mathvariant', 'displaystyle']])),
    math: ['xmlns', 'display', 'mathvariant', 'displaystyle'],
    annotation: ['encoding'],
    semantics: [],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
    href: ['http', 'https', 'mailto'],
  },
};

/**
 * Markdown de un tema → HTML seguro, y sus secciones para el índice.
 *
 * `assets` trae las URLs ya resueltas: esta función **no** habla con Storage ni con la base
 * de datos, para que se pueda probar con un mapa escrito a mano y para que quien la llame
 * decida cuánto duran las URLs firmadas.
 */
export function renderLesson(
  markdown: string,
  assets: Map<string, RenderAsset>,
  options: RenderOptions = {}
): { html: string; outline: LessonOutlineItem[] } {
  const outline: LessonOutlineItem[] = [];
  const html = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(dropLeadingTitle(options.title))
    .use(resolveImages(assets))
    .use(directivesToHtml(assets))
    // Sin `allowDangerousHtml`: el HTML escrito a mano en el Markdown no llega a ser HTML.
    .use(remarkRehype)
    .use(sectionIds(outline))
    .use(wrapTables())
    .use(imageFigures())
    .use(rehypeKatex, { output: 'mathml' })
    .use(rehypeSanitize, lessonSchema)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();

  const lang = options.language;
  return { html: lang ? `<div lang="${lang}">${html}</div>` : html, outline };
}

/** Lo mismo, solo el HTML. */
export function renderLessonHtml(
  markdown: string,
  assets: Map<string, RenderAsset>,
  options: RenderOptions = {}
): string {
  return renderLesson(markdown, assets, options).html;
}

// ───────────────────────── inline (preguntas de examen) ─────────────────────────

/** Lo que cabe dentro de una frase: énfasis, código, tachado, enlace, salto y fórmula. */
const inlineSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: ['strong', 'em', 'code', 'del', 'br', 'sub', 'sup', 'a', ...MATHML_TAGS],
  attributes: {
    a: ['href'],
    ...Object.fromEntries(MATHML_TAGS.map((tag) => [tag, ['mathvariant', 'displaystyle']])),
    math: ['xmlns', 'display', 'mathvariant', 'displaystyle'],
    annotation: ['encoding'],
    semantics: [],
  },
  protocols: { href: ['http', 'https', 'mailto'] },
  // Sin `p`, `ul`, `h1`… en `tagNames`, el saneador los desenvuelve y deja el texto.
  strip: ['script', 'style', 'img', 'iframe', 'audio', 'video'],
};

/** Varios párrafos en una frase: se separan con `<br>`, no se pegan. */
function paragraphsToBreaks() {
  return (tree: Node) => {
    const root = tree as Parent;
    const out: Node[] = [];
    for (const child of root.children) {
      const el = child as Parent & { tagName?: string; value?: string };
      // `remark-rehype` deja un texto «\n» entre bloques hermanos; sin bloques, sobra.
      if (el.type === 'text' && (el.value ?? '').trim() === '') continue;
      if (el.type === 'element' && el.tagName === 'p') {
        if (out.length > 0) {
          out.push({ type: 'element', tagName: 'br', properties: {}, children: [] } as Node);
        }
        out.push(...el.children);
      } else {
        out.push(child);
      }
    }
    root.children = out;
  };
}

/**
 * Markdown de una frase → HTML seguro **sin bloques** (27/9). Para el texto de una pregunta
 * de examen, sus opciones y su retroalimentación: negrita, cursiva, código, fórmula
 * (`$…$`) y enlace; nada de imágenes, tablas ni títulos, que en una pregunta no caben. Un
 * `**` escrito por el autor deja de verse como `**`.
 */
export function renderInlineHtml(markdown: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { output: 'mathml' })
    .use(paragraphsToBreaks)
    .use(rehypeSanitize, inlineSchema)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString()
    .trim();
}
