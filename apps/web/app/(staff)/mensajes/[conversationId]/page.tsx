/**
 * `/mensajes/[conversationId]` — un chat (5/11). SSOT: reference/01-routing/routes.md.
 *
 * El hilo en orden (lo de la persona a la izquierda; el bot y el equipo a la derecha), quién lo
 * atiende y la única acción que toca: tomarlo, responder o, quien lo tomó, cerrarlo.
 */

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { requireCapability } from '@/lib/authz/with-capability';
import { getRequestContext } from '@/lib/authz/request-context';
import { getConversation } from '@/features/messaging/server/conversations.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { cn } from '@/lib/utils';
import { AutoRefresh } from '../auto-refresh';
import { STATUS_VARIANT } from '../status';
import { CloseAction, ReplyForm, TakeAction } from '../conversation-actions';
import { ScrollToLatest } from '../scroll-to-latest';
import { ThreadItem, ThreadList } from '../thread-motion';

export const metadata: Metadata = { title: 'Chat' };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  if (!ctx.person) notFound();
  const { conversationId } = await params;
  const [conversation, t, format] = await Promise.all([
    getConversation({ institutionId: ctx.institution.id, conversationId }),
    getTranslations('messaging'),
    getFormatter(),
  ]);
  if (!conversation) notFound();

  const name = conversation.contactName ?? `+${conversation.contact}`;
  const mine = conversation.status === 'OPEN' && conversation.assignedToId === ctx.person.id;
  const takenByOther = conversation.status === 'OPEN' && !mine;

  return (
    <Page wide>
      <AutoRefresh seconds={6} />
      <PageHeader
        back={
          <Breadcrumb
            items={[
              { label: t('home'), href: '/inicio' },
              { label: t('title'), href: '/mensajes' },
              { label: name },
            ]}
          />
        }
        overline={`+${conversation.contact}`}
        title={name}
        description={
          conversation.personName && conversation.personCode ? (
            <Link
              href={`/personas/${conversation.personCode}` as Route}
              className="text-text-link underline underline-offset-4"
            >
              {t('student', { name: conversation.personName })}
            </Link>
          ) : undefined
        }
        action={
          <Badge variant={STATUS_VARIANT[conversation.status]}>
            {t(`status.${conversation.status}`)}
          </Badge>
        }
      />

      <div className="max-w-measure space-y-6">
        <section aria-label={t('thread.label', { name })}>
          {conversation.messages.length === 0 ? (
            <p className="type-body text-text-muted">{t('thread.empty')}</p>
          ) : (
            <ThreadList className="space-y-3">
              {conversation.messages.map((m) => (
                <ThreadItem
                  key={m.id}
                  inbound={m.inbound}
                  className={cn('flex', m.inbound ? 'justify-start' : 'justify-end')}
                >
                  <div
                    className={cn(
                      'rounded-card max-w-[85%] space-y-1 border px-4 py-2',
                      m.inbound
                        ? 'bg-surface-base border-border-muted'
                        : m.fromBot
                          ? 'bg-surface-sunken border-border-muted'
                          : 'bg-status-info-muted border-transparent'
                    )}
                  >
                    <p className="type-caption text-text-muted m-0">
                      {m.inbound
                        ? name
                        : m.fromBot
                          ? t('thread.bot')
                          : (m.authorName ?? t('thread.team'))}
                      {' · '}
                      <time dateTime={m.at}>
                        {format.dateTime(new Date(m.at), {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </time>
                    </p>
                    <p className="type-body text-text m-0 whitespace-pre-line break-words">
                      {m.body}
                    </p>
                  </div>
                </ThreadItem>
              ))}
            </ThreadList>
          )}
        </section>

        <section className="border-border-muted space-y-4 border-t pt-6">
          <ScrollToLatest count={conversation.messages.length} />
          {mine ? (
            <>
              {conversation.canReply ? (
                <ReplyForm conversationId={conversation.id} />
              ) : (
                <Alert severity="warning">{t('thread.noReply')}</Alert>
              )}
              <CloseAction conversationId={conversation.id} />
            </>
          ) : takenByOther ? (
            <p className="type-body text-text-muted m-0">
              {t('thread.takenByOther', { name: conversation.assignedToName ?? t('nobody') })}
            </p>
          ) : (
            <TakeAction conversationId={conversation.id} />
          )}
          <Link
            href={'/mensajes' as Route}
            className="text-text-link type-caption underline underline-offset-4"
          >
            {t('thread.back')}
          </Link>
        </section>
      </div>
    </Page>
  );
}
