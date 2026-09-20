/**
 * La biblioteca: documentos, audios y grabaciones de la cohorte, por módulo.
 * SSOT: routes.md:37, plan/08 §5.
 *
 * Las URLs de descarga son firmadas y caducan a los diez minutos: la página se pide de
 * nuevo y ya. Un enlace caducado se ve como un error de descarga; se dice en la ayuda.
 */

import type { Metadata } from 'next';
import { getTranslations, getFormatter } from 'next-intl/server';
import { FileText, Headphones, Video } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getLibraryForStudent, type LibraryItem } from '@/features/learn/server/library.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';

export const metadata: Metadata = { title: 'Biblioteca' };

const ICON = { DOCUMENT: FileText, AUDIO: Headphones, RECORDING: Video } as const;

export default async function LibraryPage() {
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

  const { modules, recordings } = await getLibraryForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

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
          <a
            href={item.href}
            className="text-text-link type-body-emphasis underline underline-offset-4"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true })}
          >
            {item.title}
            {external && <span className="sr-only"> {tl('opensExternal')}</span>}
          </a>
          <p className="type-caption text-text-muted m-0">{meta(item)}</p>
        </div>
      </li>
    );
  };

  const empty = modules.length === 0 && recordings.length === 0;

  return (
    <Page>
      <PageHeader title={tl('title')} description={tl('description')} />
      {empty ? (
        <EmptyState title={tl('empty')} description={tl('emptyHint')} />
      ) : (
        <>
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
