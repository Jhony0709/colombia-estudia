/**
 * La biblioteca: documentos, audios y grabaciones de la cohorte, por módulo.
 * SSOT: routes.md:37, plan/08 §5.
 *
 * Las URLs de descarga son firmadas y caducan a los diez minutos: la página se pide de
 * nuevo y ya. Un enlace caducado se ve como un error de descarga; se dice en la ayuda.
 *
 * E6 (23/9, docs/ux/decision-estudiante-2309.md §9): una acción con nombre por fila
 * («Descargar», «Ver la grabación») y un filtro por tipo que **solo aparece con diez o más
 * recursos** (`FILTER_FROM`): con tres archivos, un filtro es ruido. El filtro vive en la
 * URL (`?tipo=`), sin JavaScript. El buscador queda para cuando el volumen real lo pida.
 */

import type { Metadata } from 'next';
import { getTranslations, getFormatter } from 'next-intl/server';
import { FileText, Headphones, Video } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { getRequestContext } from '@/lib/authz/request-context';
import { getLibraryForStudent, type LibraryItem } from '@/features/learn/server/library.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Biblioteca' };

const ICON = { DOCUMENT: FileText, AUDIO: Headphones, RECORDING: Video } as const;

/** Desde cuántos recursos vale la pena filtrar. Por debajo, la lista entera se lee de un vistazo. */
const FILTER_FROM = 10;

const TYPE_PARAM: Record<string, LibraryItem['kind']> = {
  documentos: 'DOCUMENT',
  audios: 'AUDIO',
  grabaciones: 'RECORDING',
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const tl = await getTranslations('learn.library');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={tl('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const all = await getLibraryForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  const total = all.modules.reduce((n, m) => n + m.items.length, 0) + all.recordings.length;

  const sp = await searchParams;
  const tipoRaw = Array.isArray(sp.tipo) ? sp.tipo[0] : sp.tipo;
  const tipo = tipoRaw && tipoRaw in TYPE_PARAM ? tipoRaw : null;
  const wanted = tipo ? TYPE_PARAM[tipo] : null;
  const canFilter = total >= FILTER_FROM;

  const modules =
    canFilter && wanted
      ? all.modules
          .map((m) => ({ ...m, items: m.items.filter((i) => i.kind === wanted) }))
          .filter((m) => m.items.length > 0)
      : all.modules;
  const recordings = canFilter && wanted && wanted !== 'RECORDING' ? [] : all.recordings;

  const meta = (item: LibraryItem) =>
    [
      item.lessonTitle,
      item.sizeBytes !== null
        ? `${format.number(item.sizeBytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`
        : null,
      item.durationSeconds !== null
        ? tl('duration', { minutes: Math.round(item.durationSeconds / 60) })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const Item = ({ item }: { item: LibraryItem }) => {
    const Icon = ICON[item.kind];
    const external = item.kind === 'RECORDING';
    return (
      <li className="flex items-center gap-3 py-3">
        <span className="bg-surface-sunken rounded-control text-text-muted inline-flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-body-emphasis m-0">{item.title}</p>
          <p className="type-caption text-text-muted m-0">{meta(item)}</p>
        </div>
        {/* Una acción con nombre; el título va en el nombre accesible para que los enlaces no sean todos «Descargar». */}
        <a
          href={item.href}
          className="text-text-link type-body min-h-touch inline-flex shrink-0 items-center underline underline-offset-4"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true })}
        >
          {tl(external ? 'action.recording' : 'action.download')}
          <span className="sr-only">
            : {item.title}
            {external && ` ${tl('opensExternal')}`}
          </span>
        </a>
      </li>
    );
  };

  const filterLink = (key: string | null, label: string, current: boolean) => (
    <li key={key ?? 'all'}>
      <Link
        href={(key ? `/aprender/biblioteca?tipo=${key}` : '/aprender/biblioteca') as Route}
        aria-current={current ? 'page' : undefined}
        className={cn(
          'type-caption rounded-pill min-h-touch inline-flex items-center px-3 font-medium',
          current
            ? 'bg-brand-yellow text-text'
            : 'bg-surface-sunken text-text-muted hover:text-text'
        )}
      >
        {label}
      </Link>
    </li>
  );

  const empty = total === 0;
  const filteredEmpty = !empty && modules.length === 0 && recordings.length === 0;

  return (
    <Page>
      <PageHeader title={tl('title')} description={tl('description')} />
      {empty ? (
        <EmptyState title={tl('empty')} description={tl('emptyHint')} />
      ) : (
        <>
          {canFilter && (
            <nav aria-label={tl('filter.label')}>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {filterLink(null, tl('filter.all', { count: total }), tipo === null)}
                {Object.keys(TYPE_PARAM).map((key) =>
                  filterLink(key, tl(`filter.${key}`), tipo === key)
                )}
              </ul>
            </nav>
          )}
          {filteredEmpty && <p className="type-body text-text-muted">{tl('filter.empty')}</p>}
          {modules.map((m) => (
            <PageSection key={m.id} title={m.name}>
              <ul className="divide-border-muted divide-y">
                {m.items.map((item) => (
                  <Item key={item.id} item={item} />
                ))}
              </ul>
            </PageSection>
          ))}
          {recordings.length > 0 && (
            <PageSection title={tl('recordings')} description={tl('recordingsHint')}>
              <ul className="divide-border-muted divide-y">
                {recordings.map((item) => (
                  <Item key={item.id} item={item} />
                ))}
              </ul>
            </PageSection>
          )}
        </>
      )}
    </Page>
  );
}
