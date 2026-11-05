/**
 * `/mensajes` — la bandeja de chats (5/11). SSOT: reference/01-routing/routes.md.
 *
 * Por estado: los que esperan asesor primero (el que más lleva esperando arriba), los míos, los
 * que están en curso, los que atiende el bot y los cerrados. Cada fila lleva al hilo.
 */

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { requireCapability } from '@/lib/authz/with-capability';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  countWaitingConversations,
  listConversations,
  type ConversationView,
} from '@/features/messaging/server/conversations.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { SectionNav } from '@/components/molecules/section-nav';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { AutoRefresh } from './auto-refresh';
import { STATUS_VARIANT } from './status';

export const metadata: Metadata = { title: 'Mensajes' };

const SECTIONS: Record<string, ConversationView> = {
  mios: 'mine',
  'en-curso': 'open',
  bot: 'bot',
  cerrados: 'closed',
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string | string[] }>;
}) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  if (!ctx.person) return null;
  const institutionId = ctx.institution.id;
  const { seccion } = await searchParams;
  const view: ConversationView = (typeof seccion === 'string' && SECTIONS[seccion]) || 'waiting';
  const now = new Date();

  const [rows, waiting, t, format] = await Promise.all([
    listConversations({ institutionId, personId: ctx.person.id, view }),
    countWaitingConversations(institutionId),
    getTranslations('messaging'),
    getFormatter(),
  ]);

  const tabs: Array<{ view: ConversationView; href: Route }> = [
    { view: 'waiting', href: '/mensajes' as Route },
    { view: 'mine', href: '/mensajes?seccion=mios' as Route },
    { view: 'open', href: '/mensajes?seccion=en-curso' as Route },
    { view: 'bot', href: '/mensajes?seccion=bot' as Route },
    { view: 'closed', href: '/mensajes?seccion=cerrados' as Route },
  ];

  return (
    <Page wide>
      <AutoRefresh />
      <PageHeader
        back={<Breadcrumb items={[{ label: t('home'), href: '/inicio' }, { label: t('title') }]} />}
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
      />
      <SectionNav
        label={t('tabs.label')}
        items={tabs.map((tab) => ({
          href: tab.href,
          label: t(`tabs.${tab.view}`),
          ...(tab.view === 'waiting' ? { count: waiting } : {}),
        }))}
      />
      <DataTable
        caption={t('caption', { view: t(`tabs.${view}`) })}
        rows={rows}
        rowKey={(row) => row.id}
        align="top"
        empty={<EmptyState icon={MessageCircle} title={t('empty')} description={t('emptyHint')} />}
        columns={[
          {
            key: 'contact',
            header: t('columns.contact'),
            cell: (row) => (
              <>
                <Link
                  href={`/mensajes/${row.id}` as Route}
                  className="text-text-link type-body-emphasis underline underline-offset-4"
                >
                  {row.contactName ?? `+${row.contact}`}
                </Link>
                <span className="type-caption text-text-muted block">
                  +{row.contact}
                  {row.personName && <> · {t('student', { name: row.personName })}</>}
                </span>
              </>
            ),
          },
          {
            key: 'last',
            header: t('columns.last'),
            cell: (row) =>
              row.lastMessage ? (
                <span className="type-caption text-text-muted line-clamp-2 max-w-prose">
                  {!row.lastMessage.inbound && <>{t('fromYou')} </>}
                  {row.lastMessage.body}
                </span>
              ) : null,
            hideBelow: 'md',
          },
          {
            key: 'status',
            header: t('columns.status'),
            cell: (row) => (
              <Badge variant={STATUS_VARIANT[row.status]}>{t(`status.${row.status}`)}</Badge>
            ),
          },
          {
            key: 'assignee',
            header: t('columns.assignee'),
            cell: (row) => (
              <span className="type-caption text-text-muted">
                {row.assignedToName ?? t('nobody')}
              </span>
            ),
            hideBelow: 'lg',
          },
          {
            key: 'when',
            header: t('columns.when'),
            cell: (row) => (
              <time
                className="type-caption text-text-muted"
                dateTime={row.lastMessageAt}
                title={format.dateTime(new Date(row.lastMessageAt), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              >
                {format.relativeTime(new Date(row.lastMessageAt), now)}
              </time>
            ),
            hideBelow: 'md',
          },
        ]}
      />
    </Page>
  );
}
