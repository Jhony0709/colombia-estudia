/**
 * El calendario del estudiante: fechas de la cohorte, vencimientos y sesiones en vivo.
 * SSOT: routes.md:36, plan/08 §5.
 *
 * Una lista por fecha, lo próximo primero y lo pasado plegado: en un celular se lee; una
 * cuadrícula de mes con tres eventos no dice nada. «Unirse» se activa desde 15 minutos
 * antes (lo decide el servidor, `joinable`), y antes de eso el enlace no es un enlace.
 *
 * E5 (23/9, docs/ux/decision-estudiante-2309.md §5): agenda **accionable** en tres tramos,
 * «Hoy» / «Próximos 7 días» / «Después», con la distancia en cada fila («mañana», «en 3
 * días») y la acción a la derecha (Unirse, Abrir el examen). El fin de acceso sale **una
 * sola vez**, arriba, con la distancia («faltan 84 días»), no como una fila más entre los
 * plazos. Los días se cuentan en Bogotá; las fechas sin hora (`@db.Date`) en UTC.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { CalendarDays, Video, ClipboardCheck, Flag } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCalendarForStudent } from '@/features/learn/server/calendar.service';
import type { CalendarItem } from '@/features/cohorts/server/live-sessions.service';
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

const TIME_ZONE = 'America/Bogota';
const DAY_MS = 86_400_000;

/** Inicio/fin de cohorte y fin de acceso son `@db.Date` (medianoche UTC), no instantes. */
const isDateOnly = (item: CalendarItem) =>
  item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE';

/** Clave de día («2026-09-23») en Bogotá para los instantes y en UTC para las fechas solas. */
const dayKey = (date: Date, dateOnly: boolean) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: dateOnly ? 'UTC' : TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const dayNumber = (key: string) =>
  Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / DAY_MS;

type Bucket = 'today' | 'week' | 'later';

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

  // Todas las cohortes activas (21/9), no solo la más reciente.
  const items = await getCalendarForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

  const now = Date.now();
  const today = dayNumber(dayKey(new Date(now), false));
  /** Días de calendario hasta el ítem: 0 hoy, 1 mañana, negativo si ya pasó. */
  const daysUntil = (item: CalendarItem) =>
    dayNumber(dayKey(new Date(item.at), isDateOnly(item))) - today;

  const live = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() >= now);
  const past = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() < now).reverse();
  // El fin de acceso se dice una vez, arriba, y no compite con los plazos.
  const access = live.filter((i) => i.kind === 'ACCESS_UNTIL');
  const upcoming = live.filter((i) => i.kind !== 'ACCESS_UNTIL');
  const buckets: Record<Bucket, CalendarItem[]> = { today: [], week: [], later: [] };
  for (const item of upcoming) {
    const days = daysUntil(item);
    buckets[days <= 0 ? 'today' : days <= 7 ? 'week' : 'later'].push(item);
  }

  const when = (item: CalendarItem) => {
    const start = new Date(item.at);
    const dateOnly = item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE';
    // Una fecha sin hora (inicio/fin de cohorte, fin de acceso: `@db.Date`, medianoche UTC)
    // se pinta en UTC: en Bogotá, «2026-10-01» salía como «30 de septiembre» (visto con
    // Estudiante Uno, 23/9). Las sesiones y los plazos sí son instantes y van en hora local.
    const date = format.dateTime(start, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(dateOnly ? { timeZone: 'UTC' } : {}),
    });
    if (dateOnly) return date;
    const time = format.dateTime(start, { hour: 'numeric', minute: '2-digit' });
    const end = item.endsAt
      ? ` – ${format.dateTime(new Date(item.endsAt), { hour: 'numeric', minute: '2-digit' })}`
      : '';
    return `${date}, ${time}${end}`;
  };

  /** «hoy», «mañana», «en 3 días»: la distancia que uno calcula de cabeza, ya calculada. */
  const distance = (item: CalendarItem, showPast = false) => {
    const days = daysUntil(item);
    if (days < 0) return showPast ? tc('distancePast', { days: -days }) : null;
    return tc('distance', { days });
  };

  /** La acción de la fila: una y con nombre propio. Sin acción, nada (no un «Ver» de relleno). */
  const Action = ({ item }: { item: CalendarItem }) => {
    if (item.kind === 'LIVE_SESSION') {
      // Una sesión que ya terminó no promete un enlace «15 minutos antes».
      if (new Date(item.endsAt ?? item.at).getTime() < now) return null;
      return item.joinable && item.href ? (
        <Button asChild>
          <a href={item.href} target="_blank" rel="noopener noreferrer">
            {tc('join')}
          </a>
        </Button>
      ) : (
        <span className="type-caption text-text-muted">{tc('joinLater')}</span>
      );
    }
    if (item.kind === 'ASSESSMENT_DUE' && item.href) {
      return (
        <Button asChild variant="secondary">
          <Link href={item.href}>{tc('openExam')}</Link>
        </Button>
      );
    }
    return null;
  };

  const Item = ({ item, showPast = false }: { item: CalendarItem; showPast?: boolean }) => {
    const Icon = ICON[item.kind];
    const far = distance(item, showPast);
    return (
      <li className="flex items-start gap-3 py-3">
        <span className="bg-surface-sunken rounded-control text-text-muted inline-flex size-10 shrink-0 items-center justify-center">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-caption text-text-muted m-0">
            {tc(`kind.${item.kind}`)}
            {far && <> · {far}</>}
          </p>
          <p className="type-body-emphasis m-0">{item.title}</p>
          <p className="type-body m-0">{when(item)}</p>
          {item.description && (
            <p className="type-caption text-text-muted m-0 mt-1">{item.description}</p>
          )}
        </div>
        <div className="shrink-0 self-center">
          <Action item={item} />
        </div>
      </li>
    );
  };

  const Group = ({ bucket }: { bucket: Bucket }) => {
    const rows = buckets[bucket];
    return (
      <section aria-labelledby={`agenda-${bucket}`} className="mt-4 first:mt-0">
        <h3 id={`agenda-${bucket}`} className="type-overline text-text-muted m-0 uppercase">
          {tc(`bucket.${bucket}`)}
        </h3>
        {rows.length === 0 ? (
          <p className="type-body text-text-muted m-0 py-3">{tc(`nothing.${bucket}`)}</p>
        ) : (
          <ul className="divide-border-muted divide-y">
            {rows.map((item) => (
              <Item key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <Page>
      <PageHeader title={tc('title')} description={tc('description')} />

      {items.length === 0 ? (
        <EmptyState title={tc('empty')} description={tc('emptyHint')} />
      ) : (
        <>
          {access.length > 0 && (
            <ul className="m-0 list-none space-y-1 p-0">
              {access.map((item) => (
                <li key={item.id} className="type-body text-text-muted m-0">
                  {tc('accessUntil', {
                    cohort: item.title,
                    // Con año: «faltan 362 días» y «20 de septiembre» sin año se leen como hoy.
                    date: format.dateTime(new Date(item.at), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }),
                    days: daysUntil(item),
                  })}
                </li>
              ))}
            </ul>
          )}

          <PageSection title={tc('upcoming')} id="proximo">
            {upcoming.length === 0 ? (
              <p className="type-body text-text-muted">{tc('nothingUpcoming')}</p>
            ) : (
              <>
                <Group bucket="today" />
                <Group bucket="week" />
                {buckets.later.length > 0 && <Group bucket="later" />}
              </>
            )}
          </PageSection>
          {past.length > 0 && (
            <details>
              <summary className="type-body-emphasis min-h-touch inline-flex cursor-pointer items-center">
                {tc('past', { count: past.length })}
              </summary>
              <ul className="divide-border-muted mt-2 divide-y">
                {past.map((item) => (
                  <Item key={item.id} item={item} showPast />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Page>
  );
}
