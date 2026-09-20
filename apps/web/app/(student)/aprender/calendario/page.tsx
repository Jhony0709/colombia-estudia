/**
 * El calendario del estudiante: fechas de la cohorte, vencimientos y sesiones en vivo.
 * SSOT: routes.md:36, plan/08 §5.
 *
 * Una lista por fecha, lo próximo primero y lo pasado plegado: en un celular se lee; una
 * cuadrícula de mes con tres eventos no dice nada. «Unirse» se activa desde 15 minutos
 * antes (lo decide el servidor, `joinable`), y antes de eso el enlace no es un enlace.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { CalendarDays, Video, ClipboardCheck, Flag } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import {
  getCalendarForEnrollment,
  type CalendarItem,
} from '@/features/cohorts/server/live-sessions.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';

export const metadata: Metadata = { title: 'Calendario' };

const ICON = {
  COHORT_START: Flag,
  COHORT_END: Flag,
  ACCESS_UNTIL: CalendarDays,
  ASSESSMENT_DUE: ClipboardCheck,
  LIVE_SESSION: Video,
} as const;

export default async function CalendarPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const tc = await getTranslations('learn.calendar');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={tc('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const outline = await getCohortOutline({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  const items = outline.enrollmentId
    ? await getCalendarForEnrollment({
        institutionId: ctx.institution.id,
        enrollmentId: outline.enrollmentId,
      })
    : [];

  const now = Date.now();
  const upcoming = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() >= now);
  const past = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() < now).reverse();

  const when = (item: CalendarItem) => {
    const start = new Date(item.at);
    const dateOnly = item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE';
    const date = format.dateTime(start, { weekday: 'long', day: 'numeric', month: 'long' });
    if (dateOnly) return date;
    const time = format.dateTime(start, { hour: 'numeric', minute: '2-digit' });
    const end = item.endsAt
      ? ` – ${format.dateTime(new Date(item.endsAt), { hour: 'numeric', minute: '2-digit' })}`
      : '';
    return `${date}, ${time}${end}`;
  };

  const Item = ({ item }: { item: CalendarItem }) => {
    const Icon = ICON[item.kind];
    return (
      <li className="flex items-start gap-3 py-3">
        <span className="bg-surface-sunken rounded-control text-text-muted inline-flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-caption text-text-muted m-0">{tc(`kind.${item.kind}`)}</p>
          <p className="type-body-emphasis m-0">
            {item.kind === 'ASSESSMENT_DUE' && item.href ? (
              <Link href={item.href} className="text-text-link underline underline-offset-4">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </p>
          <p className="type-body m-0">{when(item)}</p>
          {item.description && (
            <p className="type-caption text-text-muted m-0 mt-1">{item.description}</p>
          )}
        </div>
        {item.kind === 'LIVE_SESSION' &&
          (item.joinable && item.href ? (
            <Button asChild>
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                {tc('join')}
              </a>
            </Button>
          ) : (
            <span className="type-caption text-text-muted">{tc('joinLater')}</span>
          ))}
      </li>
    );
  };

  return (
    <Page>
      <PageHeader title={tc('title')} description={tc('description')} />

      {items.length === 0 ? (
        <EmptyState title={tc('empty')} description={tc('emptyHint')} />
      ) : (
        <>
          <PageSection title={tc('upcoming')} id="proximo">
            {upcoming.length === 0 ? (
              <p className="type-body text-text-muted">{tc('nothingUpcoming')}</p>
            ) : (
              <ul className="divide-border-muted divide-y">
                {upcoming.map((item) => (
                  <Item key={item.id} item={item} />
                ))}
              </ul>
            )}
          </PageSection>
          {past.length > 0 && (
            <details>
              <summary className="type-body-emphasis min-h-touch inline-flex cursor-pointer items-center">
                {tc('past', { count: past.length })}
              </summary>
              <ul className="divide-border-muted mt-2 divide-y">
                {past.map((item) => (
                  <Item key={item.id} item={item} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Page>
  );
}
