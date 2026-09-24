'use client';

/**
 * El editor de un tema, propio: una lista de bloques, cada uno un campo.
 * SSOT: plan/07-contenido-y-migracion.md:28, PRODUCT_DECISIONS.md (19/9, editor de bloques).
 *
 * **Sin `contenteditable`.** Un párrafo es un `<textarea>` que crece con el texto; un título es
 * un `<input>` con su nivel; un vídeo es una tarjeta con el reproductor. Son controles de
 * formulario: el lector de pantalla los lee, el teclado los recorre, el móvil los sabe
 * escribir, deshacer es el del navegador. Todo lo que un editor de texto enriquecido tiene
 * que reinventar —selección, deshacer, pegado, IME— aquí lo pone el navegador.
 *
 * La negrita, la cursiva y el enlace siguen siendo Markdown DENTRO del bloque (`**así**`), y
 * los botones de formato lo escriben por el autor sobre lo que tenga seleccionado. El autor
 * puede ignorar los botones y escribirlo a mano: es lo mismo.
 *
 * Lo que sale es Markdown (`blocks.ts`), recortado del original bloque a bloque: lo que no se
 * toca vuelve byte a byte. Con retraso de 300 ms; el autoguardado de la pantalla ya espera
 * cinco segundos.
 *
 * **Pegar una dirección de Vimeo en un bloque de texto lo convierte en vídeo.** Es lo que un
 * autor va a hacer más veces, y no tiene por qué saber que existe un menú para eso.
 */

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  FileText,
  ImageIcon,
  Italic,
  Languages,
  Link2,
  Music,
  Plus,
  Settings2,
  Sigma,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { Badge } from '@/components/atoms/badge';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { MenuItem, MenuSeparator } from '@/components/molecules/menu';
import { Tooltip } from '@/components/atoms/tooltip';
import { cn } from '@/lib/utils';
import {
  blockIndexForLine,
  blocksToMarkdown,
  emptyBlock,
  markdownToBlocks,
  newId,
  vimeoIdFrom,
  wrapSelection,
  type Block,
  type BlockKind,
} from './blocks';
import { EditorDialog } from './editor-dialog';

/* ─────────────────────────── La interfaz pública ─────────────────────────── */

export interface BlockEditorHandle {
  /** Lleva el foco al bloque que contiene esa línea del Markdown guardado. */
  goToLine: (line: number) => void;
}

/** Lo que el editor sabe de cada medio del tema: lo que devuelve `/media` (`lesson-media.tsx`). */
export interface MediaCatalogItem {
  mediaAssetId: string;
  kind: string;
  provider: string;
  providerRef: string;
  durationSeconds: number | null;
  missingCaptions: boolean;
}

export interface BlockEditorProps {
  /** El `id` del elemento que da nombre al editor. */
  labelledBy: string;
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  media: MediaCatalogItem[];
  /** Registra un vídeo por su dirección y devuelve su id, o `null` si no se pudo. */
  onRegisterVideo: (video: string) => Promise<{ mediaAssetId: string } | null>;
  /** Abre la accesibilidad de un medio (transcripción, subtítulos): el engranaje del bloque. */
  onMediaSettings: (mediaAssetId: string) => void;
}

const SERIALIZE_DEBOUNCE_MS = 300;

type Dialog =
  | { kind: 'video'; afterId: string | null }
  | { kind: 'link'; blockId: string }
  | { kind: 'lang'; blockId: string }
  | null;

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
  { labelledBy, initialMarkdown, onChange, media, onRegisterVideo, onMediaSettings },
  ref
) {
  const t = useTranslations('blockEditor');
  const [blocks, setBlocks] = useState<Block[]>(() => markdownToBlocks(initialMarkdown));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  // Lo último que salió hacia fuera. Se compara el Markdown y no «si es la primera vez»:
  // React en desarrollo monta los efectos dos veces, y un contador de primera vez marcaba
  // «cambios sin guardar» nada más abrir el tema.
  const emitted = useRef<string>(blocksToMarkdown(blocks));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Hacia fuera, Markdown, con retraso, y solo si de verdad cambió.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const markdown = blocksToMarkdown(blocks);
      if (markdown === emitted.current) return;
      emitted.current = markdown;
      onChange(markdown);
    }, SERIALIZE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [blocks, onChange]);

  // Al desmontar, lo que quedaba en el retraso sale igualmente: la pantalla cambia el editor
  // por el área de Markdown (24/9) y los últimos 300 ms de escritura no pueden perderse.
  // En desarrollo React monta y desmonta los efectos dos veces; el primer desmontaje no
  // emite nada porque el Markdown coincide con lo ya emitido.
  const latest = useRef({ blocks, onChange });
  latest.current = { blocks, onChange };
  useEffect(
    () => () => {
      const markdown = blocksToMarkdown(latest.current.blocks);
      if (markdown === emitted.current) return;
      emitted.current = markdown;
      latest.current.onChange(markdown);
    },
    []
  );

  // El foco va al bloque recién creado, movido o señalado por un aviso.
  useEffect(() => {
    if (!focusId) return;
    const field = root.current?.querySelector<HTMLElement>(
      `[data-block-id="${focusId}"] textarea, [data-block-id="${focusId}"] input, [data-block-id="${focusId}"] [data-block-focus]`
    );
    field?.focus();
    field?.scrollIntoView({ block: 'center' });
    setFocusId(null);
  }, [focusId, blocks]);

  useImperativeHandle(
    ref,
    () => ({
      goToLine: (line) => {
        const index = blockIndexForLine(blocks, line);
        setFocusId(blocks[index]?.id ?? null);
      },
    }),
    [blocks]
  );

  /* ── operaciones sobre la lista ── */

  const update = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? ({ ...block, ...patch } as Block) : block))
    );
  }, []);

  const replace = useCallback((id: string, next: Block) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? next : block)));
    setFocusId(next.id);
  }, []);

  const insertAfter = useCallback((afterId: string | null, next: Block) => {
    setBlocks((prev) => {
      if (afterId === null) return [...prev, next];
      const index = prev.findIndex((block) => block.id === afterId);
      return [...prev.slice(0, index + 1), next, ...prev.slice(index + 1)];
    });
    setFocusId(next.id);
  }, []);

  const remove = useCallback((id: string) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      const next = prev.filter((block) => block.id !== id);
      const neighbour = next[Math.max(0, index - 1)];
      setFocusId(neighbour?.id ?? null);
      // Nunca cero bloques: sin uno, no hay dónde escribir.
      return next.length > 0 ? next : [emptyBlock('text')];
    });
  }, []);

  const move = useCallback((id: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setFocusId(id);
  }, []);

  /** Registra un vídeo y lo mete como bloque: detrás de `afterId`, o en el sitio de `replaceId`. */
  const addVideo = useCallback(
    async (video: string, where: { afterId: string | null } | { replaceId: string }) => {
      const pending = 'replaceId' in where ? where.replaceId : (where.afterId ?? 'end');
      setRegistering(pending);
      try {
        const registered = await onRegisterVideo(video);
        if (!registered) return false;
        const block: Block = {
          id: newId(),
          kind: 'media',
          media: 'video',
          assetId: registered.mediaAssetId,
        };
        if ('replaceId' in where) replace(where.replaceId, block);
        else insertAfter(where.afterId, block);
        return true;
      } finally {
        setRegistering(null);
      }
    },
    [insertAfter, onRegisterVideo, replace]
  );

  const addBlock = (afterId: string | null, kind: BlockKind) => {
    if (kind === 'media') {
      setDialog({ kind: 'video', afterId });
      return;
    }
    if (kind === 'image') {
      insertAfter(afterId, { id: newId(), kind: 'image', alt: '', assetId: '' });
      return;
    }
    insertAfter(afterId, emptyBlock(kind));
  };

  return (
    <div ref={root} role="group" aria-labelledby={labelledBy} className="space-y-3">
      <ol className="space-y-3">
        {blocks.map((block, index) => (
          <li key={block.id} data-block-id={block.id}>
            <BlockRow
              block={block}
              index={index}
              count={blocks.length}
              media={media}
              onMediaSettings={onMediaSettings}
              registering={registering === block.id}
              onUpdate={update}
              onReplace={replace}
              onRemove={remove}
              onMove={move}
              onAdd={addBlock}
              onEnter={() => insertAfter(block.id, emptyBlock('text'))}
              onBackspaceEmpty={() => remove(block.id)}
              onPasteVideo={(video) => void addVideo(video, { replaceId: block.id })}
              onLink={() => setDialog({ kind: 'link', blockId: block.id })}
              onLang={() => setDialog({ kind: 'lang', blockId: block.id })}
            />
          </li>
        ))}
      </ol>

      <AddBlockMenu
        label={t('addBlock')}
        onPick={(kind) => addBlock(null, kind)}
        trigger={
          <span className="type-label text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-control inline-flex items-center gap-2 px-3">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t('addBlock')}
          </span>
        }
      />

      <VideoDialog
        open={dialog?.kind === 'video'}
        busy={registering !== null}
        onClose={() => setDialog(null)}
        onSubmit={async (video) => {
          const afterId = dialog?.kind === 'video' ? dialog.afterId : null;
          const ok = await addVideo(video, { afterId });
          if (ok) setDialog(null);
          return ok;
        }}
      />
      <WrapDialog
        open={dialog?.kind === 'link' || dialog?.kind === 'lang'}
        mode={dialog?.kind === 'lang' ? 'lang' : 'link'}
        onClose={() => setDialog(null)}
        onSubmit={(value) => {
          if (!dialog || (dialog.kind !== 'link' && dialog.kind !== 'lang')) return;
          const field = root.current?.querySelector<HTMLTextAreaElement>(
            `[data-block-id="${dialog.blockId}"] textarea`
          );
          const block = blocks.find((candidate) => candidate.id === dialog.blockId);
          if (!field || !block || block.kind !== 'text') return;
          const start = field.selectionStart;
          const end = field.selectionEnd;
          const wrapped =
            dialog.kind === 'link'
              ? wrapSelection(block.markdown, start, end, '[', `](${value})`)
              : wrapSelection(block.markdown, start, end, ':lang[', `]{lang="${value}"}`);
          update(block.id, { markdown: wrapped.text });
          setDialog(null);
          setFocusId(block.id);
          // El foco vuelve al campo con el cursor tras lo envuelto, no al final del párrafo.
          requestAnimationFrame(() => {
            field.focus();
            field.setSelectionRange(wrapped.end, wrapped.end);
          });
        }}
      />
    </div>
  );
});

/* ─────────────────────────── Una fila ─────────────────────────── */

interface RowProps {
  block: Block;
  index: number;
  count: number;
  media: MediaCatalogItem[];
  onMediaSettings: (mediaAssetId: string) => void;
  registering: boolean;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onReplace: (id: string, next: Block) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onAdd: (afterId: string, kind: BlockKind) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onPasteVideo: (video: string) => void;
  onLink: () => void;
  onLang: () => void;
}

function BlockRow(props: RowProps) {
  const { block, index, count, onRemove, onMove, onAdd } = props;
  const t = useTranslations('blockEditor');
  const n = index + 1;
  const kindLabel = t(`kind.${block.kind}`);

  return (
    <section
      aria-label={t('blockLabel', { index: n, kind: kindLabel })}
      className="border-border-muted rounded-control focus-within:border-border group border bg-transparent"
    >
      {/*
        La cabecera de la fila: qué es y qué se puede hacer con ella. Siempre visible pero
        apagada; con el foco dentro, entera. Los nombres accesibles llevan el número del
        bloque: en una lista de veinte, «subir» a secas no dice qué.
      */}
      <div className="text-text-subtle group-focus-within:text-text-muted flex flex-wrap items-center gap-1 px-2 pt-1">
        <span className="type-caption px-1">{kindLabel}</span>
        <span className="flex-1" />
        <RowButton
          label={t('moveUp', { index: n })}
          Icon={ArrowUp}
          disabled={index === 0}
          onClick={() => onMove(block.id, -1)}
        />
        <RowButton
          label={t('moveDown', { index: n })}
          Icon={ArrowDown}
          disabled={index === count - 1}
          onClick={() => onMove(block.id, 1)}
        />
        <AddBlockMenu
          label={t('addAfter', { index: n })}
          onPick={(kind) => onAdd(block.id, kind)}
          trigger={
            <span className="rounded-control min-h-control min-w-control hover:bg-surface-sunken hover:text-text inline-flex items-center justify-center">
              <Plus aria-hidden="true" className="h-4 w-4" />
            </span>
          }
        />
        <RowButton
          label={t('remove', { index: n })}
          Icon={Trash2}
          onClick={() => onRemove(block.id)}
        />
      </div>

      <div className="px-3 pb-3">
        <BlockBody {...props} />
      </div>
    </section>
  );
}

function RowButton({
  label,
  Icon,
  disabled,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'rounded-control min-h-control min-w-control flex items-center justify-center',
          disabled
            ? 'text-text-subtle pointer-events-none'
            : 'hover:bg-surface-sunken hover:text-text'
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </button>
    </Tooltip>
  );
}

/* ─────────────────────────── El cuerpo de cada tipo ─────────────────────────── */

function BlockBody(props: RowProps) {
  const {
    block,
    onUpdate,
    onReplace,
    onEnter,
    onBackspaceEmpty,
    onPasteVideo,
    onLink,
    onLang,
    media,
    onMediaSettings,
    registering,
  } = props;
  const t = useTranslations('blockEditor');
  const listCaret = useRef<{ start: number; end: number } | null>(null);

  switch (block.kind) {
    case 'text':
      return (
        <TextBlock
          value={block.markdown}
          placeholder={t('textPlaceholder')}
          registering={registering}
          onChange={(markdown) => onUpdate(block.id, { markdown })}
          onEnter={onEnter}
          onBackspaceEmpty={onBackspaceEmpty}
          onPasteVideo={onPasteVideo}
          onLink={onLink}
          onLang={onLang}
        />
      );
    case 'heading':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* Un campo a pelo, sin `FormField`: el título se escribe como el texto de al lado,
                sin marco, y su nombre accesible es el propio marcador de posición. */}
            <input
              type="text"
              aria-label={t('headingPlaceholder')}
              placeholder={t('headingPlaceholder')}
              value={block.text}
              className={cn(
                'text-text placeholder:text-text-subtle block w-full bg-transparent py-1 outline-none',
                block.level === 2 && 'type-heading',
                block.level === 3 && 'type-subheading',
                block.level === 4 && 'type-body-emphasis'
              )}
              onChange={(event) => onUpdate(block.id, { text: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnter();
                }
              }}
            />
          </div>
          <select
            aria-label={t('headingLevel')}
            value={String(block.level)}
            onChange={(event) =>
              onUpdate(block.id, { level: Number(event.target.value) as 2 | 3 | 4 })
            }
            className="border-border bg-surface-base text-text type-caption min-h-control rounded-control border px-2"
          >
            <option value="2">{t('level2')}</option>
            <option value="3">{t('level3')}</option>
            <option value="4">{t('level4')}</option>
          </select>
        </div>
      );
    case 'list':
      return (
        <GrowingTextarea
          pendingSelection={listCaret}
          value={block.markdown}
          ariaLabel={t('kind.list')}
          hint={t('listHint')}
          onChange={(markdown) => onUpdate(block.id, { markdown })}
          onKeyDown={(event) => {
            // Intro continúa la lista con el mismo marcador; Intro en un elemento vacío la cierra.
            if (event.key !== 'Enter' || event.shiftKey) return;
            const field = event.currentTarget;
            const before = field.value.slice(0, field.selectionStart);
            const line = before.slice(before.lastIndexOf('\n') + 1);
            const marker = /^(\s*)(- \[[ x]\] |- |\* |\d+\. )/.exec(line);
            if (!marker) return;
            event.preventDefault();
            if (line.trim() === marker[2]!.trim()) {
              // Elemento vacío: salir de la lista a un párrafo nuevo.
              onUpdate(block.id, {
                markdown: field.value.slice(0, before.length - line.length).replace(/\n$/, ''),
              });
              onEnter();
              return;
            }
            const numbered = /^(\s*)(\d+)\. /.exec(line);
            const next = numbered
              ? `${numbered[1]}${Number(numbered[2]) + 1}. `
              : `${marker[1]}${marker[2]!.replace('[x]', '[ ]')}`;
            const after = field.value.slice(field.selectionEnd);
            const text = `${before}\n${next}${after}`;
            const caret = before.length + 1 + next.length;
            listCaret.current = { start: caret, end: caret };
            onUpdate(block.id, { markdown: text });
          }}
        />
      );
    case 'quote':
      return (
        <GrowingTextarea
          value={block.text}
          ariaLabel={t('kind.quote')}
          placeholder={t('quotePlaceholder')}
          className="border-border border-l-[3px] pl-4"
          onChange={(text) => onUpdate(block.id, { text })}
        />
      );
    case 'code':
      return (
        <div className="space-y-2">
          <div className="w-48">
            <FormField label={t('codeLanguage')} name={`lang-${block.id}`}>
              <FormInput
                name={`lang-${block.id}`}
                value={block.language}
                spellCheck={false}
                onChange={(event) => onUpdate(block.id, { language: event.target.value })}
              />
            </FormField>
          </div>
          <GrowingTextarea
            value={block.code}
            ariaLabel={t('kind.code')}
            placeholder={t('codePlaceholder')}
            mono
            onChange={(code) => onUpdate(block.id, { code })}
          />
        </div>
      );
    case 'table':
      return (
        <GrowingTextarea
          value={block.markdown}
          ariaLabel={t('kind.table')}
          hint={t('tableHint')}
          mono
          onChange={(markdown) => onUpdate(block.id, { markdown })}
        />
      );
    case 'math':
      return (
        <GrowingTextarea
          value={block.latex}
          ariaLabel={t('kind.math')}
          placeholder={t('mathPlaceholder')}
          hint={t('mathHint')}
          mono
          onChange={(latex) => onUpdate(block.id, { latex })}
        />
      );
    case 'image':
      return (
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[16rem] flex-1">
            <FormField
              label={t('imageAlt')}
              name={`alt-${block.id}`}
              required
              hint={t('imageAltHint')}
            >
              <FormInput
                name={`alt-${block.id}`}
                value={block.alt}
                onChange={(event) => onUpdate(block.id, { alt: event.target.value })}
              />
            </FormField>
          </div>
          <div className="w-64">
            <FormField
              label={t('imageAsset')}
              name={`asset-${block.id}`}
              required
              hint={t('imageAssetHint')}
            >
              <FormInput
                name={`asset-${block.id}`}
                value={block.assetId}
                spellCheck={false}
                onChange={(event) => onUpdate(block.id, { assetId: event.target.value })}
              />
            </FormField>
          </div>
        </div>
      );
    case 'media':
      return (
        <MediaBlock
          block={block}
          media={media}
          onSettings={() => onMediaSettings(block.assetId)}
          onRemove={() => onReplace(block.id, emptyBlock('text'))}
        />
      );
    case 'rule':
      return <hr data-block-focus tabIndex={-1} className="border-border-muted my-2" />;
    case 'raw':
      return (
        <GrowingTextarea
          value={block.markdown}
          ariaLabel={t('kind.raw')}
          hint={t('rawHint')}
          mono
          onChange={(markdown) => onUpdate(block.id, { markdown })}
        />
      );
  }
}

/* ─────────────────────────── Texto: el bloque de escribir ─────────────────────────── */

function TextBlock({
  value,
  placeholder,
  registering,
  onChange,
  onEnter,
  onBackspaceEmpty,
  onPasteVideo,
  onLink,
  onLang,
}: {
  value: string;
  placeholder: string;
  registering: boolean;
  onChange: (markdown: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onPasteVideo: (video: string) => void;
  onLink: () => void;
  onLang: () => void;
}) {
  const t = useTranslations('blockEditor');
  const field = useRef<HTMLTextAreaElement>(null!);
  // La selección que hay que dejar tras envolver. Se aplica en el `useLayoutEffect` del campo,
  // DESPUÉS de que React pinte el valor nuevo: hacerlo antes —o en el siguiente fotograma—
  // deja el cursor al final, porque un campo controlado lo mueve al cambiar de valor.
  const pending = useRef<{ start: number; end: number } | null>(null);

  const wrap = (before: string, after: string) => {
    const node = field.current;
    if (!node) return;
    const next = wrapSelection(node.value, node.selectionStart, node.selectionEnd, before, after);
    pending.current = { start: next.start, end: next.end };
    onChange(next.text);
  };

  const tools: Array<{ key: string; label: string; Icon: LucideIcon; run: () => void }> = [
    { key: 'bold', label: t('bold'), Icon: Bold, run: () => wrap('**', '**') },
    { key: 'italic', label: t('italic'), Icon: Italic, run: () => wrap('*', '*') },
    { key: 'code', label: t('code'), Icon: Code, run: () => wrap('`', '`') },
    { key: 'link', label: t('link'), Icon: Link2, run: onLink },
    { key: 'lang', label: t('lang'), Icon: Languages, run: onLang },
    { key: 'math', label: t('mathInline'), Icon: Sigma, run: () => wrap('$', '$') },
  ];

  return (
    <div className="space-y-1">
      <GrowingTextarea
        fieldRef={field}
        pendingSelection={pending}
        value={value}
        ariaLabel={t('kind.text')}
        placeholder={registering ? t('videoRegistering') : placeholder}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            // Intro abre un bloque nuevo, como en cualquier editor de documento; Mayús+Intro
            // es el salto de línea dentro del párrafo.
            event.preventDefault();
            onEnter();
          } else if (event.key === 'Backspace' && event.currentTarget.value === '') {
            event.preventDefault();
            onBackspaceEmpty();
          }
        }}
        onPaste={(event) => {
          const text = event.clipboardData.getData('text/plain');
          const id = vimeoIdFrom(text);
          // Solo cuando lo pegado ES la dirección y el bloque está vacío: un párrafo que
          // menciona un vídeo no es una orden de insertarlo.
          if (id && event.currentTarget.value.trim() === '') {
            event.preventDefault();
            onPasteVideo(text.trim());
          }
        }}
      />
      {/* La barra de formato solo con el foco dentro: en cada párrafo, seis botones siempre
          a la vista serían más botones que texto. */}
      <div
        role="toolbar"
        aria-label={t('format')}
        className="hidden items-center gap-0.5 group-focus-within:flex"
      >
        {tools.map(({ key, label, Icon, run }) => (
          <Tooltip key={key} label={label} side="bottom">
            <button
              type="button"
              // `onMouseDown` con `preventDefault`: el botón no roba el foco al campo, así que
              // la selección sobre la que se aplica la negrita sigue siendo la del autor.
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
              className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-control min-w-control flex items-center justify-center"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Un campo que crece ─────────────────────────── */

function GrowingTextarea({
  fieldRef,
  pendingSelection,
  value,
  ariaLabel,
  placeholder,
  hint,
  mono = false,
  className,
  onChange,
  onKeyDown,
  onPaste,
}: {
  fieldRef?: RefObject<HTMLTextAreaElement>;
  pendingSelection?: MutableRefObject<{ start: number; end: number } | null>;
  value: string;
  ariaLabel: string;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  const local = useRef<HTMLTextAreaElement>(null!);
  const node = fieldRef ?? local;

  // Crece con el texto y nunca enseña barra de desplazamiento: un párrafo se lee entero.
  useLayoutEffect(() => {
    const field = node.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;

    const selection = pendingSelection?.current;
    if (selection) {
      pendingSelection.current = null;
      field.focus();
      field.setSelectionRange(selection.start, selection.end);
    }
  }, [value, node, pendingSelection]);

  return (
    <div className="space-y-1">
      <textarea
        ref={node}
        value={value}
        rows={1}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck={!mono}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className={cn(
          'type-body text-text placeholder:text-text-subtle block w-full resize-none bg-transparent py-1 outline-none',
          mono && 'font-mono',
          className
        )}
      />
      {hint && <p className="type-caption text-text-muted">{hint}</p>}
    </div>
  );
}

/* ─────────────────────────── El medio ─────────────────────────── */

const MEDIA_ICONS: Record<'video' | 'audio' | 'pdf', LucideIcon> = {
  video: Video,
  audio: Music,
  pdf: FileText,
};

function MediaBlock({
  block,
  media,
  onSettings,
  onRemove,
}: {
  block: Extract<Block, { kind: 'media' }>;
  media: MediaCatalogItem[];
  onSettings: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('blockEditor');
  const te = useTranslations('editor');
  const item = media.find((candidate) => candidate.mediaAssetId === block.assetId);
  const Icon = MEDIA_ICONS[block.media];
  const vimeo = item?.provider === 'VIMEO' ? item.providerRef : null;
  const minutes =
    item?.durationSeconds != null ? Math.max(1, Math.round(item.durationSeconds / 60)) : null;
  const kind = te(
    `mediaKind.${block.media === 'pdf' ? 'DOCUMENT' : block.media.toUpperCase()}` as 'mediaKind.VIDEO'
  );

  return (
    <div
      data-block-focus
      tabIndex={-1}
      className="bg-surface-sunken rounded-control overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <Icon aria-hidden="true" className="text-text-muted h-4 w-4 shrink-0" />
        <span className="type-body-emphasis text-text">{kind}</span>
        {vimeo !== null && <span className="type-caption text-text-muted">vimeo.com/{vimeo}</span>}
        {minutes !== null && <span className="type-caption text-text-muted">{minutes} min</span>}
        {item && (
          <Badge variant={item.missingCaptions ? 'warning' : 'success'}>
            {item.missingCaptions ? t('mediaBlocked') : t('mediaOk')}
          </Badge>
        )}
        <span className="flex-1" />
        {item && (
          // La accesibilidad del vídeo —transcripción, subtítulos— se arregla desde aquí, que
          // es donde se está mirando el vídeo, y no en una tarjeta aparte al final.
          <Tooltip label={t('mediaSettings')}>
            <button
              type="button"
              onClick={onSettings}
              className="text-text-muted hover:text-text hover:bg-surface-base rounded-control min-h-control min-w-control flex items-center justify-center"
            >
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{t('mediaSettings')}</span>
            </button>
          </Tooltip>
        )}
        <Tooltip label={t('mediaRemove')}>
          <button
            type="button"
            onClick={onRemove}
            className="text-text-muted hover:text-text hover:bg-surface-base rounded-control min-h-control min-w-control flex items-center justify-center"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">{t('mediaRemove')}</span>
          </button>
        </Tooltip>
      </div>

      {vimeo !== null && block.media === 'video' && (
        // El mismo reproductor que verá el estudiante (`render.ts:133`), cargado tarde: tres
        // vídeos en un tema no tienen que descargar tres reproductores para leer el texto.
        <div className="aspect-video bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${vimeo}?dnt=1`}
            title={`${kind} vimeo.com/${vimeo}`}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            className="h-full w-full"
          />
        </div>
      )}
      {vimeo === null && (
        <p className="type-caption text-text-muted px-3 pb-2 font-mono">{block.assetId || '—'}</p>
      )}
    </div>
  );
}

/* ─────────────────────────── Añadir un bloque ─────────────────────────── */

const ADDABLE: Array<{ kind: BlockKind; Icon?: LucideIcon }> = [
  { kind: 'text' },
  { kind: 'heading' },
  { kind: 'list' },
  { kind: 'quote' },
  { kind: 'media', Icon: Video },
  { kind: 'image', Icon: ImageIcon },
  { kind: 'math', Icon: Sigma },
  { kind: 'table' },
  { kind: 'code' },
  { kind: 'rule' },
];

function AddBlockMenu({
  label,
  trigger,
  onPick,
}: {
  label: string;
  trigger: ReactNode;
  onPick: (kind: BlockKind) => void;
}) {
  const t = useTranslations('blockEditor');
  return (
    <Dropdown.Root>
      <Tooltip label={label}>
        <Dropdown.Trigger
          aria-label={label}
          className="data-[state=open]:bg-surface-sunken rounded-control"
        >
          {trigger}
        </Dropdown.Trigger>
      </Tooltip>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={4}
          className="bg-surface-raised border-border-muted rounded-card elevation-floating min-w-48 border p-1"
        >
          {ADDABLE.map(({ kind }, index) => (
            <span key={kind}>
              {index === 4 && <MenuSeparator />}
              <MenuItem onSelect={() => onPick(kind)}>
                {kind === 'media' ? t('addVideo') : t(`kind.${kind}`)}
              </MenuItem>
            </span>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/* ─────────────────────────── Los diálogos ─────────────────────────── */

function VideoDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (video: string) => Promise<boolean>;
}) {
  const t = useTranslations('blockEditor');
  const [video, setVideo] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <EditorDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('videoTitle')}
      description={t('videoHint')}
      submitLabel={t('insert')}
      cancelLabel={t('cancel')}
      busy={busy}
      disabled={video.trim() === ''}
      onSubmit={async () => {
        setError(null);
        const ok = await onSubmit(video.trim());
        if (ok) setVideo('');
        else setError(t('videoError'));
      }}
    >
      <FormField
        label={t('videoUrl')}
        name="video-url"
        required
        hint={t('videoUrlHint')}
        error={error ?? undefined}
      >
        <FormInput
          name="video-url"
          value={video}
          spellCheck={false}
          onChange={(e) => setVideo(e.target.value)}
        />
      </FormField>
    </EditorDialog>
  );
}

function WrapDialog({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'link' | 'lang';
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const t = useTranslations('blockEditor');
  const [value, setValue] = useState('');
  const valid =
    mode === 'link' ? value.trim() !== '' : /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value.trim());

  return (
    <EditorDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={mode === 'link' ? t('linkTitle') : t('langTitle')}
      description={mode === 'link' ? t('linkHint') : t('langHint')}
      submitLabel={t('apply')}
      cancelLabel={t('cancel')}
      disabled={!valid}
      onSubmit={() => {
        onSubmit(value.trim());
        setValue('');
      }}
    >
      <FormField
        label={mode === 'link' ? t('linkUrl') : t('langCode')}
        name="wrap-value"
        required
        hint={mode === 'lang' ? t('langCodeHint') : undefined}
      >
        <FormInput
          name="wrap-value"
          type={mode === 'link' ? 'url' : 'text'}
          value={value}
          spellCheck={false}
          className={mode === 'lang' ? 'w-32' : undefined}
          onChange={(e) => setValue(e.target.value)}
        />
      </FormField>
    </EditorDialog>
  );
}
