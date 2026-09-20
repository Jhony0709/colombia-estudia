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
}

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
        node.url = '';
        node.alt = 'Las imágenes se suben a la biblioteca y se citan como asset:<id>';
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
    img: [...(defaultSchema.attributes?.img ?? []), 'loading'],
    figure: ['className'],
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
 * Markdown de un tema → HTML seguro.
 *
 * `assets` trae las URLs ya resueltas: esta función **no** habla con Storage ni con la base
 * de datos, para que se pueda probar con un mapa escrito a mano y para que quien la llame
 * decida cuánto duran las URLs firmadas.
 */
export function renderLessonHtml(
  markdown: string,
  assets: Map<string, RenderAsset>,
  options: RenderOptions = {}
): string {
  const html = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(resolveImages(assets))
    .use(directivesToHtml(assets))
    // Sin `allowDangerousHtml`: el HTML escrito a mano en el Markdown no llega a ser HTML.
    .use(remarkRehype)
    .use(rehypeKatex, { output: 'mathml' })
    .use(rehypeSanitize, lessonSchema)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();

  const lang = options.language;
  return lang ? `<div lang="${lang}">${html}</div>` : html;
}
