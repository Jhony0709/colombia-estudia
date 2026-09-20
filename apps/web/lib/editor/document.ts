/**
 * El documento de un tema, como lo manipula el editor.
 * SSOT: packages/types/src/content.ts (lo que el validador acepta),
 * PRODUCT_DECISIONS.md:83-90 («el editor es una capa; el formato no depende de él»).
 *
 * Lo guardado sigue siendo Markdown y no cambia. Esto es la forma intermedia entre ese texto
 * y un editor visual: un árbol de bloques y de trozos en línea, sin nada que el formato no
 * sepa expresar. Si algo no cabe aquí, no cabe en el tema, y es mejor descubrirlo al escribir
 * el modelo que al guardar por primera vez encima del trabajo de alguien.
 *
 * Deliberadamente NO hay nodo de HTML crudo: `content.ts:232` lo rechaza. Un editor que
 * pudiera producirlo produciría temas impublicables.
 */

/** Los trozos dentro de un párrafo. */
export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'emphasis'; children: Inline[] }
  | { type: 'delete'; children: Inline[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'inlineMath'; value: string }
  | { type: 'link'; url: string; children: Inline[] }
  | { type: 'image'; assetId: string; alt: string }
  /** `:lang[texto]{lang=en}` — un fragmento en otro idioma, para el lector de pantalla. */
  | { type: 'lang'; language: string; children: Inline[] };

/** Un elemento de lista. `checked` no nulo lo convierte en casilla (GFM). */
export interface ListItem {
  checked: boolean | null;
  children: Block[];
}

export type TableAlign = 'left' | 'right' | 'center' | null;

export type Block =
  /**
   * Empieza en 2: `heading-h1-reserved` (publish-validation.ts:345) reserva el h1 para el
   * título del tema, que no se escribe en el contenido.
   */
  | { type: 'heading'; depth: 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'list'; ordered: boolean; start: number | null; items: ListItem[] }
  | { type: 'code'; lang: string | null; value: string }
  | { type: 'math'; value: string }
  | { type: 'table'; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] }
  | { type: 'thematicBreak' }
  /** `::video{asset="…"}`, `::audio{…}`, `::pdf{…}`. */
  | { type: 'asset'; kind: 'video' | 'audio' | 'pdf'; assetId: string }
  /** Una imagen que ocupa su propio bloque: `![alt](asset:id)`. */
  | { type: 'image'; assetId: string; alt: string };

export interface LessonDoc {
  blocks: Block[];
}

export const emptyDoc = (): LessonDoc => ({
  blocks: [{ type: 'paragraph', children: [] }],
});
