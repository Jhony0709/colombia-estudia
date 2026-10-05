/**
 * Las piezas del panel del estudiante (4/10, auditoría del lado estudiante): cifras, ritmo,
 * exámenes, próximas fechas y ayuda. Cada una responde una pregunta —¿cuánto llevo?, ¿cómo
 * voy?, ¿cómo me fue?, ¿qué viene?, ¿a quién pregunto?— y no aparece si no tiene nada que
 * decir. Gráficos según la skill de dataviz: la forma por la tarea, una serie sin leyenda, el
 * estado en texto e icono, fechas formateadas aquí (F4).
 */

import Link from 'next/link';
import type { Route } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Clock,
  Flag,
  MessageCircle,
  Mail,
  Target,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/atoms/button';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { ActivityColumns, type ActivityDay } from '@/components/molecules/charts/ActivityColumns';
import { DayStrip } from '@/components/molecules/charts/DayStrip';
import { ExamBullet, type ExamBulletState } from '@/components/molecules/charts/ExamBullet';
import type { CohortOutline } from '@/features/learn/server/cohort.service';
import type { StudyActivity } from '@/features/learn/server/activity.service';
import type { ResultsForStudent } from '@/features/learn/server/attempt.service';
import { primaryContact } from '@/features/marketing/contact-links';

/** Una tarjeta del panel: título, enlace opcional a la pantalla que lo explica, contenido. */
export function DashCard({
  id,
  title,
  hint,
  moreHref,
  moreLabel,
  children,
  className,
}: {
  id: string;
  title: string;
  hint?: string;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className={cn(
        'bg-surface-base rounded-card elevation-resting space-y-5 p-5 sm:p-6',
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 space-y-1">
          <h2 id={`${id}-titulo`} className="type-subheading text-text m-0">
            {title}
          </h2>
          {hint && <p className="type-caption text-text-muted m-0">{hint}</p>}
        </div>
        {moreHref && moreLabel && (
          <Link
            href={moreHref as Route}
            className="type-caption text-text-link min-h-touch inline-flex items-center gap-1 underline underline-offset-4"
          >
            {moreLabel}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────── cifras ───────────────────────────

/**
 * Tres cifras con su micro-gráfico: avance (medidor), tiempo que queda (de cuánto) y días con
 * actividad (tira de 14 días). Sustituye a la franja de tres números del 27/9, que repetía el
 * porcentaje del héroe sin decir nada nuevo.
 */
export async function ProgressKpis({
  outline,
  activity,
}: {
  outline: CohortOutline;
  activity: StudyActivity;
}) {
  const t = await getTranslations('learn.kpis');
  const items = outline.modules.flatMap((m) => m.items);
  if (items.length === 0) return null;
  const completed = items.filter((i) => i.status === 'COMPLETED').length;
  const percent = Math.round((completed / items.length) * 100);
  const totalMinutes = items.reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0);
  const remaining = items
    .filter((i) => i.status !== 'COMPLETED')
    .reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0);
  const program = outline.cohort?.programName ?? '';

  const tile = 'bg-surface-base rounded-card elevation-resting min-w-0 space-y-3 p-4 sm:p-5';
  return (
    // En el teléfono, dos por fila y la tercera a lo ancho: tres tarjetas apiladas empujaban el
    // ritmo y las fechas una pantalla más abajo.
    <section aria-label={t('label')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <div className={tile}>
        <p className="type-caption text-text-muted m-0 inline-flex items-center gap-2">
          <Target aria-hidden className="size-4" />
          {t('progress')}
        </p>
        <p className="type-display text-text m-0">{percent} %</p>
        <ProgressBar percent={percent} label={t('progressLabel', { program })} grow />
        <p className="type-caption text-text-muted m-0">
          {t('progressHint', { completed, total: items.length })}
        </p>
      </div>

      {totalMinutes > 0 && (
        <div className={tile}>
          <p className="type-caption text-text-muted m-0 inline-flex items-center gap-2">
            <Clock aria-hidden className="size-4" />
            {t('time')}
          </p>
          <p className="type-display text-text m-0">
            {remaining === 0 ? t('timeDone') : t('timeValue', { minutes: remaining })}
          </p>
          <ProgressBar
            percent={((totalMinutes - remaining) / totalMinutes) * 100}
            label={t('timeLabel')}
            grow
          />
          <p className="type-caption text-text-muted m-0">
            {t('timeHint', { done: totalMinutes - remaining, total: totalMinutes })}
          </p>
        </div>
      )}

      <div className={cn(tile, 'col-span-2 sm:col-span-1', totalMinutes === 0 && 'col-span-1')}>
        <p className="type-caption text-text-muted m-0 inline-flex items-center gap-2">
          <CalendarDays aria-hidden className="size-4" />
          {t('days')}
        </p>
        <p className="type-display text-text m-0">
          {t('daysValue', { active: activity.activeDays, total: activity.days.length })}
        </p>
        <DayStrip days={activity.days} />
        <p className="type-caption text-text-muted m-0">
          {t('daysHint', { thisWeek: activity.thisWeek, lastWeek: activity.lastWeek })}
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────── ritmo ───────────────────────────

/** Pasos completados por día, dos semanas. La pregunta: ¿estoy avanzando con constancia? */
export async function RhythmCard({ activity }: { activity: StudyActivity }) {
  const [t, format] = await Promise.all([getTranslations('learn.rhythm'), getFormatter()]);
  const total = activity.days.reduce((sum, d) => sum + d.steps, 0);
  const last = activity.days.length - 1;
  // Mediodía UTC: el día de Bogotá formateado sin que la zona lo mueva al anterior.
  const asDate = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

  const days: ActivityDay[] = activity.days.map((day, index) => {
    const date = asDate(day.date);
    const name = format.dateTime(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
    return {
      date: day.date,
      steps: day.steps,
      today: index === last,
      short:
        index === last
          ? t('today')
          : format.dateTime(date, { weekday: 'narrow', timeZone: 'UTC' }).toUpperCase(),
      description: t('dayDescription', {
        steps: day.steps,
        day: index === last ? t('todayLong', { date: name }) : name,
      }),
    };
  });

  return (
    <DashCard id="ritmo" title={t('title')} hint={t('hint')}>
      {/* En el teléfono el gráfico enseña la semana actual; la cifra dice lo mismo que se ve. */}
      <p className="type-body text-text m-0 hidden sm:block">
        <span className="type-heading">{total}</span>{' '}
        <span className="text-text-muted">{t('total', { count: total })}</span>
      </p>
      <p className="type-body text-text m-0 sm:hidden">
        <span className="type-heading">{activity.thisWeek}</span>{' '}
        <span className="text-text-muted">{t('totalWeek', { count: activity.thisWeek })}</span>
      </p>
      <ActivityColumns days={days} label={t('chartLabel')} />
      {total === 0 && <p className="type-caption text-text-muted m-0">{t('empty')}</p>}
    </DashCard>
  );
}

// ─────────────────────────── exámenes ───────────────────────────

/** Cada examen del programa elegido: mejor nota contra el umbral. ¿Cómo me fue? */
export async function ExamsCard({ exams }: { exams: ResultsForStudent['assessments'] }) {
  if (exams.length === 0) return null;
  const t = await getTranslations('learn.exams');

  return (
    <DashCard
      id="examenes"
      title={t('title')}
      hint={t('hint')}
      moreHref="/aprender/resultados"
      moreLabel={t('more')}
    >
      <ul className="m-0 list-none space-y-5 p-0">
        {exams.slice(0, 4).map((exam) => {
          const state: ExamBulletState = exam.best
            ? exam.best.passed
              ? 'passed'
              : 'failed'
            : !exam.enabled
              ? 'locked'
              : 'pending';
          const status =
            state === 'passed'
              ? t('passed', { percent: exam.best!.percent })
              : state === 'failed'
                ? t('failed', { percent: exam.best!.percent })
                : state === 'locked'
                  ? t('locked')
                  : exam.status === 'IN_PROGRESS'
                    ? t('inProgress')
                    : t('pending');
          return (
            <li key={exam.assignmentId}>
              <ExamBullet
                title={exam.title}
                href={exam.enabled ? `/aprender/examen/${exam.assignmentId}` : null}
                state={state}
                percent={exam.best?.percent ?? null}
                passPercent={exam.passPercent}
                status={status}
                summary={
                  exam.best
                    ? t('summary', {
                        percent: exam.best.percent,
                        pass: exam.passPercent ?? 0,
                        hasPass: exam.passPercent === null ? 'no' : 'yes',
                      })
                    : t('summaryNone', {
                        pass: exam.passPercent ?? 0,
                        hasPass: exam.passPercent === null ? 'no' : 'yes',
                      })
                }
              />
            </li>
          );
        })}
      </ul>
      {exams.some((e) => e.passPercent !== null) && (
        <p className="type-caption text-text-muted m-0 inline-flex items-center gap-2">
          <span aria-hidden className="bg-text inline-block h-3 w-0.5 rounded-full" />
          {t('legend')}
        </p>
      )}
    </DashCard>
  );
}

// ─────────────────────────── próximas fechas ───────────────────────────

export interface AgendaItem {
  id: string;
  kind: 'COHORT_START' | 'COHORT_END' | 'ACCESS_UNTIL' | 'ASSESSMENT_DUE' | 'LIVE_SESSION';
  title: string;
  at: string;
  href: string | null;
}

const AGENDA_ICONS = {
  COHORT_START: Flag,
  COHORT_END: Flag,
  ACCESS_UNTIL: CalendarClock,
  ASSESSMENT_DUE: CalendarClock,
  LIVE_SESSION: Video,
} as const;

/** Lo que viene, con la fecha en baldosa (día grande, mes corto): ¿qué viene y cuándo? */
export async function AgendaCard({ items }: { items: AgendaItem[] }) {
  const [t, format] = await Promise.all([getTranslations('learn.agenda'), getFormatter()]);
  return (
    <DashCard id="fechas" title={t('title')} moreHref="/aprender/calendario" moreLabel={t('more')}>
      {items.length === 0 ? (
        <p className="type-body text-text-muted m-0">{t('empty')}</p>
      ) : (
        <ul className="m-0 list-none space-y-4 p-0">
          {items.map((item) => {
            const date = new Date(item.at);
            const Icon = AGENDA_ICONS[item.kind];
            // Las fechas de cohorte y de acceso son días (`@db.Date`, medianoche UTC): en la
            // zona de Bogotá caerían el día anterior. Se nombran por lo que son; la cohorte va
            // de contexto.
            const dayOnly = item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE';
            const zone = dayOnly ? { timeZone: 'UTC' } : {};
            const otherYear = date.getUTCFullYear() !== new Date().getUTCFullYear();
            const heading = dayOnly ? t(`kind.${item.kind}`) : item.title;
            const context = dayOnly ? item.title : t(`kind.${item.kind}`);
            return (
              <li key={item.id} className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="bg-surface-sunken rounded-control flex w-12 shrink-0 flex-col items-center py-1.5"
                >
                  <span className="type-overline text-text-muted uppercase">
                    {format.dateTime(date, { month: 'short', ...zone }).replace('.', '')}
                  </span>
                  <span className="type-heading text-text">
                    {format.dateTime(date, { day: 'numeric', ...zone })}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  {item.href ? (
                    <Link
                      href={item.href as Route}
                      className="type-body-emphasis text-text-link block underline underline-offset-4"
                    >
                      {heading}
                    </Link>
                  ) : (
                    <span className="type-body-emphasis text-text block">{heading}</span>
                  )}
                  <span className="type-caption text-text-muted inline-flex items-center gap-1.5">
                    <Icon aria-hidden className="size-3.5" />
                    {context} ·{' '}
                    {format.dateTime(date, {
                      weekday: 'long',
                      ...(item.kind === 'LIVE_SESSION'
                        ? { hour: 'numeric', minute: '2-digit' }
                        : {}),
                      ...zone,
                    })}
                    {otherYear && ` · ${format.dateTime(date, { year: 'numeric', ...zone })}`}
                    {/* La baldosa es visual; el lector oye la fecha entera aquí. */}
                    <span className="sr-only">
                      {' '}
                      {format.dateTime(date, { day: 'numeric', month: 'long', ...zone })}
                    </span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashCard>
  );
}

// ─────────────────────────── ayuda ───────────────────────────

/** ¿A quién pregunto? WhatsApp si la institución tiene teléfono (28/9), correo si no. */
export async function HelpCard({
  phone,
  email,
  name,
}: {
  phone: string | null;
  email: string | null;
  name: string;
}) {
  if (!phone && !email) return null;
  const t = await getTranslations('learn.aside');
  const contact = primaryContact(phone, email ?? '', t('helpMessage', { name }));
  const viaWhatsApp = contact.external;
  return (
    <DashCard id="ayuda" title={t('help')}>
      <p className="type-body text-text-muted m-0">{t('helpBody')}</p>
      <Button asChild variant="secondary">
        <a
          href={contact.href}
          {...(viaWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {viaWhatsApp ? (
            <MessageCircle aria-hidden className="size-4" />
          ) : (
            <Mail aria-hidden className="size-4" />
          )}
          {viaWhatsApp ? t('contactWhatsApp') : t('contact')}
          {viaWhatsApp && <span className="sr-only"> {t('newTab')}</span>}
        </a>
      </Button>
    </DashCard>
  );
}
