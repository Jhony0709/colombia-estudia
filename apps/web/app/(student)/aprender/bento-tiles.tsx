/**
 * Los módulos del inicio en grid (20/11, maqueta «Inicio A · Foco»): cada uno responde una
 * pregunta corta —¿cómo voy en la etapa?, ¿qué debo?, ¿cómo va mi semana?, ¿qué viene?,
 * ¿dónde estoy en la ruta?, ¿a quién pregunto?— con a lo sumo un enlace.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, Mail, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutlineModule } from '@/features/learn/server/cohort.service';
import type { StudyActivity } from '@/features/learn/server/activity.service';
import type { AccountView } from '@/features/billing/server/billing.service';
import { primaryContact } from '@/features/marketing/contact-links';
import type { AgendaItem } from './dashboard-cards';

const TILE =
  'bg-surface-base border-border-muted rounded-card flex min-w-0 flex-col gap-3 border p-5';

function TileTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="type-overline text-text-muted m-0 uppercase">
      {children}
    </h2>
  );
}

function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className="type-body-emphasis text-text-link min-h-touch mt-auto inline-flex items-center gap-1.5 underline underline-offset-4"
    >
      {children}
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

/** ¿Cómo voy en la etapa? El anillo del componente por el que va. */
export async function StageTile({
  module,
  index,
  total,
}: {
  module: OutlineModule;
  index: number;
  total: number;
}) {
  const t = await getTranslations('learn.tiles');
  const done = module.items.filter((i) => i.status === 'COMPLETED').length;
  const count = module.items.length;
  const percent = count === 0 ? 0 : Math.round((done / count) * 100);
  return (
    <section aria-labelledby="tile-etapa" className={TILE}>
      <TileTitle id="tile-etapa">{t('stage')}</TileTitle>
      <div className="flex items-center gap-4">
        <svg
          role="img"
          aria-label={t('stageRing', { percent, module: module.name })}
          viewBox="0 0 36 36"
          className="size-16 shrink-0"
        >
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            strokeWidth="4"
            className="stroke-surface-sunken"
          />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${percent} 100`}
            transform="rotate(-90 18 18)"
            className="stroke-accent-base"
          />
        </svg>
        <div className="min-w-0">
          <p className="type-heading text-text m-0 tabular-nums">{percent} %</p>
          <p className="type-caption text-text-muted m-0 truncate">{module.name}</p>
        </div>
      </div>
      <p className="type-caption text-text-muted m-0">
        {t('stageMeta', { index: index + 1, total, done, count })}
      </p>
    </section>
  );
}

/** ¿Qué debo? La próxima cuota y lo que abre. */
export async function PaymentTile({ account }: { account: AccountView }) {
  const [t, format] = await Promise.all([getTranslations('learn.tiles'), getFormatter()]);
  const next = account.summary.next;
  const installment = next ? account.installments.find((i) => i.id === next.id) : undefined;
  const overdue = account.installments.some((i) => i.overdue);
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  return (
    <section
      aria-labelledby="tile-pago"
      className={cn(TILE, overdue && 'border-status-warning-base')}
    >
      <TileTitle id="tile-pago">
        {overdue ? t('paymentOverdue') : next ? t('payment') : t('paymentDone')}
      </TileTitle>
      {next ? (
        <>
          <p className="type-heading text-text m-0 tabular-nums">{cop(next.amount)}</p>
          <p className="type-caption text-text-muted m-0">
            {t('paymentMeta', { position: next.position, date: day(next.dueOn) })}
            {installment && installment.unlocks.length > 0
              ? ` · ${t('opens', { names: installment.unlocks.join(', ') })}`
              : ''}
          </p>
        </>
      ) : (
        <p className="type-body text-text m-0">{t('paymentNone')}</p>
      )}
      <TileLink href="/aprender/mi-cuenta">{next ? t('paymentCta') : t('paymentSee')}</TileLink>
    </section>
  );
}

/** ¿Qué debo? Aún nada: el plan de pagos lo define el equipo (escenario 6 de la maqueta). */
export async function NoPlanTile() {
  const t = await getTranslations('learn.tiles');
  return (
    <section aria-labelledby="tile-pago" className={TILE}>
      <TileTitle id="tile-pago">{t('paymentDone')}</TileTitle>
      <p className="type-body-emphasis text-text m-0">{t('noPlan')}</p>
      <p className="type-caption text-text-muted m-0">{t('noPlanBody')}</p>
    </section>
  );
}

/** ¿Cómo va mi semana? Los últimos siete días, uno por cuadro. */
export async function WeekTile({ activity }: { activity: StudyActivity }) {
  const [t, format] = await Promise.all([getTranslations('learn.tiles'), getFormatter()]);
  const week = activity.days.slice(-7);
  const active = week.filter((d) => d.steps > 0).length;
  return (
    <section aria-labelledby="tile-semana" className={TILE}>
      <TileTitle id="tile-semana">{t('week')}</TileTitle>
      <ol className="m-0 grid list-none grid-cols-7 gap-1.5 p-0">
        {week.map((d, i) => {
          const date = new Date(`${d.date}T12:00:00.000Z`);
          return (
            <li key={d.date} className="flex flex-col items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  'rounded-control h-7 w-full max-w-8',
                  d.steps > 0
                    ? 'bg-accent-base'
                    : i === week.length - 1
                      ? 'bg-status-info-muted'
                      : 'bg-surface-sunken'
                )}
              />
              <span aria-hidden className="type-caption text-text-muted">
                {format.dateTime(date, { weekday: 'narrow', timeZone: 'UTC' }).toUpperCase()}
              </span>
              <span className="sr-only">
                {t('weekDay', {
                  day: format.dateTime(date, { weekday: 'long', timeZone: 'UTC' }),
                  steps: d.steps,
                })}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="type-body text-text m-0">
        {active === 0
          ? t('weekEmpty')
          : t('weekSummary', { days: active, steps: activity.thisWeek })}
      </p>
    </section>
  );
}

/** ¿Qué viene? La próxima fecha que pide algo. */
export async function NextTile({ item }: { item: AgendaItem | null }) {
  const [t, format] = await Promise.all([getTranslations('learn.tiles'), getFormatter()]);
  const date = item ? new Date(item.at) : null;
  // Fechas de cohorte y de acceso son días (`@db.Date`): se pintan en UTC.
  const zone =
    item && item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE'
      ? { timeZone: 'UTC' }
      : {};
  return (
    <section aria-labelledby="tile-viene" className={TILE}>
      <TileTitle id="tile-viene">{t('next')}</TileTitle>
      {item && date ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="bg-surface-sunken rounded-control flex w-12 shrink-0 flex-col items-center py-1.5"
          >
            <span className="type-overline text-text-muted uppercase">
              {format.dateTime(date, { month: 'short', ...zone }).replace('.', '')}
            </span>
            <span className="type-heading text-text">
              {format.dateTime(date, { day: 'numeric', ...zone })}
            </span>
          </span>
          <span className="min-w-0">
            <span className="type-body-emphasis text-text line-clamp-2 block">{item.title}</span>
            <span className="type-caption text-text-muted block">
              {format.dateTime(date, { weekday: 'long', day: 'numeric', month: 'long', ...zone })}
            </span>
          </span>
        </div>
      ) : (
        <p className="type-body text-text-muted m-0">{t('nextEmpty')}</p>
      )}
      <TileLink href="/aprender/calendario">{t('nextCta')}</TileLink>
    </section>
  );
}

/** ¿Dónde estoy en la ruta? Una barra por componente, con su estado o su cuota. */
export async function RouteTile({
  modules,
  currentId,
  enrollmentId,
  programName,
  className,
}: {
  modules: OutlineModule[];
  currentId: string | null;
  enrollmentId: string;
  programName: string;
  className?: string;
}) {
  const t = await getTranslations('learn.tiles');
  const rows = modules.map((m) => {
    const done = m.items.length > 0 && m.items.every((i) => i.status === 'COMPLETED');
    const open = m.access.state === 'OPEN';
    const kind = done ? 'done' : m.id === currentId && open ? 'current' : open ? 'open' : 'locked';
    const sub =
      kind === 'done'
        ? t('routeDone')
        : kind === 'current'
          ? t('routeCurrent')
          : kind === 'open'
            ? t('routeOpen')
            : m.installment
              ? t('routeInstallment', { position: m.installment.position })
              : t('routeLocked');
    return { id: m.id, name: m.name, kind, sub };
  });
  return (
    <section aria-labelledby="tile-ruta" className={cn(TILE, className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <TileTitle id="tile-ruta">{t('route', { program: programName })}</TileTitle>
        <Link
          href={`/aprender/curso/${enrollmentId}` as Route}
          className="type-body-emphasis text-text-link min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
        >
          {t('routeCta')}
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      </div>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2 p-0">
        {rows.map((r) => (
          <li key={r.id} className="flex min-w-0 flex-col gap-1.5">
            <span
              aria-hidden
              className={cn(
                'h-2 rounded-full',
                r.kind === 'done'
                  ? 'bg-status-success-base'
                  : r.kind === 'current'
                    ? 'bg-accent-base'
                    : r.kind === 'open'
                      ? 'bg-status-info-muted'
                      : 'bg-surface-sunken'
              )}
            />
            <span
              className={cn(
                'type-caption truncate font-semibold',
                r.kind === 'locked' ? 'text-text-muted' : 'text-text'
              )}
            >
              {r.name}
            </span>
            <span className="type-caption text-text-muted truncate">{r.sub}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Otros cursos abiertos: el catálogo vive en su pantalla. */
export async function ExploreTile({ count }: { count: number }) {
  const t = await getTranslations('learn');
  return (
    <section aria-labelledby="tile-explorar" className={TILE}>
      <TileTitle id="tile-explorar">{t('explore.title')}</TileTitle>
      <p className="type-body text-text-muted m-0">{t('explore.body', { count })}</p>
      <TileLink href="/aprender/catalogo">{t('explore.cta')}</TileLink>
    </section>
  );
}

/** ¿A quién pregunto? WhatsApp si la institución tiene teléfono, correo si no. */
export async function HelpTile({
  phone,
  email,
  name,
  className,
}: {
  phone: string | null;
  email: string | null;
  name: string;
  className?: string;
}) {
  if (!phone && !email) return null;
  const t = await getTranslations('learn');
  const contact = primaryContact(phone, email ?? '', t('aside.helpMessage', { name }));
  return (
    <section
      aria-labelledby="tile-ayuda"
      className={cn('bg-surface-note rounded-card flex min-w-0 flex-col gap-3 p-5', className)}
    >
      <h2 id="tile-ayuda" className="type-subheading text-text m-0">
        {t('tiles.help')}
      </h2>
      <p className="type-body text-text-muted m-0">{t('tiles.helpBody')}</p>
      <a
        href={contact.href}
        {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="bg-surface-base border-border text-text type-body-emphasis rounded-control min-h-touch mt-auto inline-flex items-center justify-center gap-2 border px-4"
      >
        {contact.external ? (
          <MessageCircle aria-hidden className="size-4" />
        ) : (
          <Mail aria-hidden className="size-4" />
        )}
        {contact.external ? t('tiles.helpWhatsApp') : t('aside.contact')}
        {contact.external && <span className="sr-only"> {t('aside.newTab')}</span>}
      </a>
    </section>
  );
}
