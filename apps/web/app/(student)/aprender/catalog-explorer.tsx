'use client';

/**
 * El catálogo del estudiante como tienda (8/10, Jhonny: «vistas tipo e-commerce o carrusel, por
 * secciones o tipos, con filtros y orden»). Cliente por una razón: filtrar y ordenar sin ir al
 * servidor. Las tarjetas llegan ya pintadas (`card`, Server Component) con lo justo para decidir
 * (`meta`); aquí solo se eligen y se colocan.
 *
 * - **Por programa** (por defecto): un carrusel por programa, con su tipo y su aviso de
 *   solicitud; los programas, en el orden recomendado (lo que puede tomar primero).
 * - **Todos**: una cuadrícula de resultados.
 * Filtros por tipo de programa y por precio, orden, y búsqueda cuando hay más de seis. Los
 * filtros que no separan nada (un solo tipo, todo gratis) no se muestran.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { SegmentedControl } from '@/components/molecules/segmented-control';
import type { ProgramKind } from '@/lib/programs/kinds';
import { cn } from '@/lib/utils';
import { COURSE_CARD_GRID, COURSE_CARD_WIDTH } from './course-card-layout';

export interface ExplorerItem {
  key: string;
  groupId: string;
  card: ReactNode;
  meta: {
    kind: ProgramKind;
    free: boolean;
    /** Monto del precio; nulo sin precio cargado. */
    amount: number | null;
    endsOn: string;
    name: string;
    programName: string;
  };
}

export interface ExplorerGroup {
  id: string;
  /** El tipo de programa, como antetítulo del estante. */
  kind: string;
  title: string;
  meta: string;
  /** Aviso de solicitud pendiente, si lo hay. */
  notice: ReactNode | null;
}

type Sort = 'RECOMMENDED' | 'PRICE_ASC' | 'PRICE_DESC' | 'ENDS' | 'NAME';
type Price = 'ALL' | 'FREE' | 'PAID';
type View = 'SECTIONS' | 'GRID';

const SORTS: readonly Sort[] = ['RECOMMENDED', 'PRICE_ASC', 'PRICE_DESC', 'ENDS', 'NAME'];
const SEARCH_FROM = 7;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const priceOf = (m: ExplorerItem['meta']) => (m.free ? 0 : (m.amount ?? Number.POSITIVE_INFINITY));

export function CatalogExplorer({
  groups,
  items,
}: {
  groups: ExplorerGroup[];
  items: ExplorerItem[];
}) {
  const t = useTranslations('learn.catalog.explore');
  const tk = useTranslations('admin.curriculum.kind');
  const [kind, setKind] = useState<ProgramKind | 'ALL'>('ALL');
  const [price, setPrice] = useState<Price>('ALL');
  const [sort, setSort] = useState<Sort>('RECOMMENDED');
  const [view, setView] = useState<View>('SECTIONS');
  const [query, setQuery] = useState('');

  const kinds = useMemo(() => [...new Set(items.map((i) => i.meta.kind))], [items]);
  const q = fold(query.trim());
  // Precio y búsqueda; el tipo va aparte porque los chips cuentan con cada uno.
  const matches = useCallback(
    (i: ExplorerItem) =>
      (price === 'ALL' || (price === 'FREE') === i.meta.free) &&
      (q === '' || fold(`${i.meta.name} ${i.meta.programName}`).includes(q)),
    [price, q]
  );
  const hasFree = items.some((i) => i.meta.free);
  const hasPaid = items.some((i) => !i.meta.free);

  const visible = useMemo(() => {
    const order = new Map(items.map((i, index) => [i.key, index]));
    const rows = items.filter((i) => (kind === 'ALL' || i.meta.kind === kind) && matches(i));
    const by: Record<Sort, (a: ExplorerItem, b: ExplorerItem) => number> = {
      RECOMMENDED: (a, b) => order.get(a.key)! - order.get(b.key)!,
      PRICE_ASC: (a, b) => priceOf(a.meta) - priceOf(b.meta),
      PRICE_DESC: (a, b) => {
        const pa = priceOf(a.meta);
        const pb = priceOf(b.meta);
        // Sin precio cargado va al final también aquí (y dos sin precio empatan).
        if (!Number.isFinite(pa) || !Number.isFinite(pb)) {
          return Number(!Number.isFinite(pa)) - Number(!Number.isFinite(pb));
        }
        return pb - pa;
      },
      ENDS: (a, b) => a.meta.endsOn.localeCompare(b.meta.endsOn),
      NAME: (a, b) => a.meta.name.localeCompare(b.meta.name, 'es'),
    };
    return [...rows].sort((a, b) => by[sort](a, b) || order.get(a.key)! - order.get(b.key)!);
  }, [items, kind, matches, sort]);

  const filtered = kind !== 'ALL' || price !== 'ALL' || query.trim() !== '';
  const reset = () => {
    setKind('ALL');
    setPrice('ALL');
    setQuery('');
  };

  return (
    <div className="space-y-5">
      <div className="bg-surface-base border-border-muted rounded-card space-y-4 border p-3 sm:p-4">
        {items.length >= SEARCH_FROM && (
          <label className="relative block">
            <span className="sr-only">{t('search')}</span>
            <Search
              aria-hidden
              className="text-text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="rounded-control bg-surface-sunken border-border type-body text-text min-h-touch w-full border py-2 pl-9 pr-3"
            />
          </label>
        )}

        {kinds.length > 1 && (
          <div
            role="group"
            aria-label={t('kindLabel')}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {(['ALL', ...kinds] as const).map((k) => {
              const pressed = kind === k;
              // Cuántos quedan con ese tipo y los demás filtros (precio, búsqueda).
              const count = items.filter(
                (i) => (k === 'ALL' || i.meta.kind === k) && matches(i)
              ).length;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setKind(k)}
                  className={cn(
                    'rounded-pill type-label min-h-touch inline-flex shrink-0 items-center gap-1.5 border px-3.5',
                    'duration-fast ease-standard transition-colors',
                    pressed
                      ? 'bg-accent-base text-text-on-accent border-accent-base'
                      : 'bg-surface-base text-text border-border-muted hover:bg-surface-sunken'
                  )}
                >
                  {k === 'ALL' ? t('allKinds') : tk(k)}
                  <span className={cn('type-caption tabular-nums', !pressed && 'text-text-muted')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {hasFree && hasPaid && (
              <SegmentedControl<Price>
                label={t('priceLabel')}
                value={price}
                onChange={setPrice}
                options={[
                  { value: 'ALL', label: t('priceAll') },
                  { value: 'FREE', label: t('priceFree') },
                  { value: 'PAID', label: t('pricePaid') },
                ]}
              />
            )}
            <SegmentedControl<View>
              label={t('viewLabel')}
              value={view}
              onChange={setView}
              options={[
                { value: 'SECTIONS', label: t('viewSections'), icon: Rows3 },
                { value: 'GRID', label: t('viewGrid'), icon: LayoutGrid },
              ]}
            />
          </div>
          <label className="type-caption text-text-muted inline-flex items-center gap-2">
            {t('sortLabel')}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-control bg-surface-sunken border-border type-body text-text min-h-touch border px-3 py-1.5"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption text-text-muted m-0" role="status">
          {t('count', { count: visible.length })}
        </p>
        {filtered && (
          <button
            type="button"
            onClick={reset}
            className="type-caption text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
          >
            {t('clear')}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-surface-base border-border-muted rounded-card space-y-3 border p-6 text-center">
          <p className="type-body-emphasis text-text m-0">{t('emptyTitle')}</p>
          <p className="type-body text-text-muted m-0">{t('emptyBody')}</p>
          <Button type="button" variant="secondary" onClick={reset}>
            {t('clear')}
          </Button>
        </div>
      ) : view === 'GRID' ? (
        <section aria-labelledby="catalogo-cuadricula">
          {/* Las tarjetas traen su `h4` (bajo el `h3` del estante): aquí el `h3` no se ve. */}
          <h3 id="catalogo-cuadricula" className="sr-only">
            {t('gridHeading')}
          </h3>
          <ul className={cn('m-0 grid list-none items-start gap-4 p-0', COURSE_CARD_GRID)}>
            {visible.map((i) => (
              <li key={i.key} className="min-w-0">
                {i.card}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const rows = visible.filter((i) => i.groupId === group.id);
            if (rows.length === 0) return null;
            return (
              <Shelf key={group.id} group={group} label={t('shelf', { program: group.title })}>
                {rows}
              </Shelf>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Un programa como carrusel: desliza con el dedo, la rueda o el teclado; flechas si no cabe. */
function Shelf({
  group,
  label,
  children,
}: {
  group: ExplorerGroup;
  label: string;
  children: ExplorerItem[];
}) {
  const t = useTranslations('learn.catalog.explore');
  const ref = useRef<HTMLUListElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const headingId = `estante-${group.id}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft <= 4;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      // La flecha que se apaga tenía el foco: pasa a la otra y no cae al <body> (WCAG 2.4.3).
      const active = document.activeElement;
      if (start && !end && active === prevRef.current) nextRef.current?.focus();
      if (end && !start && active === nextRef.current) prevRef.current?.focus();
      setEdges({ start, end });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [children.length]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9 });
  };
  const overflows = !(edges.start && edges.end);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="type-overline text-text-muted m-0 uppercase">{group.kind}</p>
          <h3 id={headingId} className="type-subheading text-text m-0">
            {group.title}
          </h3>
          <p className="type-caption text-text-muted m-0">
            {group.meta} · {t('shelfCount', { count: children.length })}
          </p>
        </div>
        {overflows && (
          <div className="flex gap-2">
            <Button
              ref={prevRef}
              type="button"
              variant="secondary"
              disabled={edges.start}
              onClick={() => page(-1)}
            >
              <ChevronLeft aria-hidden className="size-4" />
              <span className="sr-only">{t('previous', { program: group.title })}</span>
            </Button>
            <Button
              ref={nextRef}
              type="button"
              variant="secondary"
              disabled={edges.end}
              onClick={() => page(1)}
            >
              <ChevronRight aria-hidden className="size-4" />
              <span className="sr-only">{t('next', { program: group.title })}</span>
            </Button>
          </div>
        )}
      </div>
      {group.notice}
      {/* Sin `tabIndex` (lint jsx-a11y): cada tarjeta tiene enlaces y botones, y al tabular el
          navegador desliza hasta ellos; las flechas cubren el resto (WCAG 2.1.1).
          `relative`: sin él, los `sr-only` de las tarjetas escapan del recorte y ensanchan
          la página en el teléfono. */}
      <ul
        ref={ref}
        aria-label={label}
        className="relative -mx-1 my-0 flex snap-x snap-mandatory list-none items-start gap-4 overflow-x-auto scroll-smooth px-1 pb-3"
      >
        {children.map((i) => (
          <li key={i.key} className={cn(COURSE_CARD_WIDTH, 'shrink-0 snap-start')}>
            {i.card}
          </li>
        ))}
      </ul>
    </section>
  );
}
