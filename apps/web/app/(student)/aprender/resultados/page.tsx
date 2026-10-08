/**
 * Mis resultados (rehecho el 8/10, Jhonny: «mejora la UI/UX»). SSOT:
 * reference/01-routing/routes.md:46, reference/02-api/endpoints.md:45.
 *
 * Responde «¿cómo me fue?» programa por programa: un resumen arriba y, en cada programa, sus
 * cuestionarios —mejor nota contra el umbral y el historial de intentos en la misma tarjeta—
 * y sus notas por taller. Antes eran tres listas sueltas (exámenes, notas, intentos) con códigos
 * de cohorte, y un programa terminado salía como «no tienes exámenes asignados».
 *
 * Funciona con el acceso vencido: `score.read.own` sobrevive a `accessUntil` (capabilities.ts §8).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { ArrowRight, ChartColumn, CircleCheck, ClipboardList, History } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  getResultsForStudent,
  type ResultsForStudent,
} from '@/features/learn/server/attempt.service';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { ExamBulletBar } from '@/components/molecules/charts/ExamBullet';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { cn } from '@/lib/utils';
import { WorkshopsDisclosure } from '../workshops-disclosure';

export const metadata: Metadata = { title: 'Resultados' };

type Quiz = ResultsForStudent['assessments'][number];
type Attempt = ResultsForStudent['attempts'][number];
type Score = ResultsForStudent['scores'][number];
type ProgramState = ResultsForStudent['programs'][number]['state'];

const STATE_VARIANT: Record<ProgramState, BadgeVariant> = {
  ACTIVE: 'info',
  COMPLETED: 'success',
  CLOSED: 'neutral',
};

const passed = (q: Quiz) => q.best?.passed === true;

export default async function ResultsPage() {
  const ctx = await getRequestContext();
  const [t, tr, format] = await Promise.all([
    getTranslations('learn'),
    getTranslations('learn.results'),
    getFormatter(),
  ]);

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={tr('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const results = await getResultsForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  const { assessments, attempts, scores } = results;

  if (assessments.length === 0 && scores.length === 0) {
    return (
      <Page enter>
        <PageHeader title={tr('title')} description={tr('description')} />
        <EmptyState
          icon={ChartColumn}
          title={tr('empty')}
          description={tr('emptyHint')}
          action={
            <Button asChild variant="secondary">
              <Link href="/aprender">{tr('goHome')}</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  // Un grupo por programa: los de la persona en su orden (activo primero) y, al final, los que
  // solo aparecen en notas o intentos.
  const groups = new Map<
    string,
    { programName: string; cohortName: string | null; state: ProgramState }
  >();
  for (const p of results.programs) {
    groups.set(p.cohortId, {
      programName: p.programName,
      cohortName: p.cohortName,
      state: p.state,
    });
  }
  for (const row of [...assessments, ...scores]) {
    if (!groups.has(row.cohortId)) {
      groups.set(row.cohortId, { programName: row.programName, cohortName: null, state: 'CLOSED' });
    }
  }
  const sections = [...groups.entries()]
    .map(([cohortId, meta]) => ({
      cohortId,
      ...meta,
      quizzes: assessments.filter((q) => q.cohortId === cohortId),
      scores: scores.filter((s) => s.cohortId === cohortId),
    }))
    .filter((s) => s.quizzes.length > 0 || s.scores.length > 0);

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <Page enter>
      <PageHeader title={tr('title')} description={tr('description')} />

      {assessments.length > 0 && (
        <section aria-label={tr('summary.label')}>
          <StatGrid columns={3}>
            <StatCard
              label={tr('summary.passed')}
              value={assessments.filter(passed).length}
              icon={CircleCheck}
              tone="success"
            />
            <StatCard
              label={tr('summary.pending')}
              value={
                assessments.filter((q) => !q.fromHistory && q.enabled && q.status !== 'COMPLETED')
                  .length
              }
              icon={ClipboardList}
            />
            <StatCard
              label={tr('summary.attempts')}
              value={attempts.filter((a) => a.status !== 'IN_PROGRESS').length}
              icon={History}
            />
          </StatGrid>
        </section>
      )}

      {sections.map((section) => {
        const headingId = `programa-${section.cohortId}`;
        const done = section.quizzes.filter(passed).length;
        return (
          <section key={section.cohortId} aria-labelledby={headingId} className="space-y-5">
            <header className="space-y-1">
              <Badge variant={STATE_VARIANT[section.state]}>{tr(`state.${section.state}`)}</Badge>
              <h2 id={headingId} className="type-heading text-text m-0 text-balance">
                {section.programName}
              </h2>
              <p className="type-caption text-text-muted m-0">
                {[
                  section.cohortName,
                  section.quizzes.length > 0
                    ? tr('programPassed', { passed: done, total: section.quizzes.length })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </header>

            {/* Cuestionarios a la izquierda; las notas por taller, cortas, al lado (en el
                teléfono, debajo). */}
            <div
              className={cn(
                'grid items-start gap-6',
                section.quizzes.length > 0 &&
                  section.scores.length > 0 &&
                  'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
              )}
            >
              {section.quizzes.length > 0 && (
                <div className="min-w-0 space-y-3">
                  <h3 className="type-subheading text-text m-0">{tr('quizzesTitle')}</h3>
                  {/* Con las notas al lado, una columna: dos tarjetas en 2/3 partían cada línea. */}
                  <ul
                    className={cn(
                      'm-0 grid list-none gap-4 p-0',
                      section.scores.length === 0 && 'sm:grid-cols-2'
                    )}
                  >
                    {section.quizzes.map((quiz) => (
                      <li key={quiz.assignmentId} className="min-w-0">
                        <QuizCard
                          quiz={quiz}
                          attempts={attempts.filter((a) => a.assignmentId === quiz.assignmentId)}
                          when={when}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {section.scores.length > 0 && (
                <ScoresCard
                  scores={section.scores}
                  when={when}
                  formatValue={(v) => format.number(v, { maximumFractionDigits: 2 })}
                />
              )}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

/** Las notas por taller (0–100, la mejor calificada): nombre, nota y una barra. */
async function ScoresCard({
  scores,
  when,
  formatValue,
}: {
  scores: Score[];
  when: (iso: string) => string;
  formatValue: (v: number) => string;
}) {
  const tr = await getTranslations('learn.results');
  return (
    <section className="bg-surface-base border-border-muted rounded-card elevation-resting min-w-0 space-y-4 border p-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="type-subheading text-text m-0">{tr('scoresTitle')}</h3>
        <p className="type-caption text-text-muted m-0">{tr('scoresHint')}</p>
      </div>
      <ul className="m-0 list-none space-y-4 p-0">
        {scores.map((s) => (
          <li key={s.subjectName} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-body text-text min-w-0">{s.subjectName}</span>
              <span className="type-body-emphasis text-text tabular-nums">
                {formatValue(s.value)}
              </span>
            </div>
            <ExamBulletBar
              state="pending"
              percent={s.value}
              passPercent={null}
              summary={tr('scoreBar', { workshop: s.subjectName, value: formatValue(s.value) })}
            />
            <p className="type-caption text-text-muted m-0">
              {tr('scoreUpdated', { date: when(s.updatedAt) })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Un cuestionario: dónde está, **una frase** con su situación, la mejor nota contra el umbral
 * y sus intentos, cada uno con enlace a su revisión. La acción, si la hay, es una.
 */
async function QuizCard({
  quiz,
  attempts,
  when,
}: {
  quiz: Quiz;
  attempts: Attempt[];
  when: (iso: string) => string;
}) {
  const [t, tr] = await Promise.all([getTranslations('learn'), getTranslations('learn.results')]);

  let tone: 'neutral' | 'info' | 'success' | 'warning' = 'neutral';
  let line: string;
  let action: { href: string; label: string } | null = null;
  const open = `/aprender/examen/${quiz.assignmentId}`;

  if (quiz.status === 'COMPLETED' || quiz.fromHistory) {
    if (quiz.best) {
      tone = quiz.best.passed ? 'success' : 'warning';
      line = tr('card.best', {
        percent: quiz.best.percent,
        passed: quiz.best.passed ? 'yes' : 'no',
        count: quiz.visibleAttempts,
      });
    } else {
      line = tr('card.hidden');
    }
    if (!quiz.fromHistory) action = { href: open, label: tr('card.view') };
  } else if (!quiz.enabled) {
    line = quiz.blockedBy
      ? tr('card.blockedBy', { title: quiz.blockedBy })
      : quiz.unavailableReason === 'CLOSED'
        ? tr('card.closed')
        : quiz.unavailableReason === 'LOCKED'
          ? tr('card.locked')
          : tr('card.notYet');
  } else if (quiz.status === 'IN_PROGRESS') {
    tone = 'info';
    line =
      attempts.some((a) => a.status === 'IN_PROGRESS') || !quiz.best
        ? tr('card.inProgress')
        : tr('card.retry', { percent: quiz.best.percent });
    action = { href: open, label: tr('card.continue') };
  } else {
    line = quiz.dueAt ? tr('card.pendingDue', { date: when(quiz.dueAt) }) : tr('card.pending');
    action = { href: open, label: tr('card.start') };
  }

  const TONE = {
    neutral: 'border-l-border-muted',
    info: 'border-l-status-info-base',
    success: 'border-l-status-success-base',
    warning: 'border-l-status-warning-base',
  } as const;

  // Del más antiguo al más reciente: se lee como una historia (intento 1, 2…).
  const history = [...attempts].sort((a, b) => a.number - b.number);
  const where = [quiz.moduleName, quiz.subjectName].filter(Boolean).join(' · ');

  return (
    <article
      className={cn(
        'bg-surface-base border-border-muted rounded-card elevation-resting flex h-full flex-col gap-3 border border-l-4 p-4 sm:p-5',
        TONE[tone]
      )}
    >
      <div className="space-y-0.5">
        <h4
          className={cn(
            'type-body-emphasis m-0',
            quiz.enabled || quiz.best ? 'text-text' : 'text-text-muted'
          )}
        >
          {quiz.title}
        </h4>
        {where && <p className="type-caption text-text-muted m-0">{where}</p>}
      </div>
      <p className="type-body text-text m-0">{line}</p>

      {/* La nota contra el umbral (4/10), la misma bala que el panel. */}
      {(quiz.best || quiz.passPercent !== null) && (
        <div className="space-y-1">
          <ExamBulletBar
            state={
              quiz.best
                ? quiz.best.passed
                  ? 'passed'
                  : 'failed'
                : quiz.enabled
                  ? 'pending'
                  : 'locked'
            }
            percent={quiz.best?.percent ?? null}
            passPercent={quiz.passPercent}
            summary={tr('bar', {
              percent: quiz.best?.percent ?? 0,
              hasBest: quiz.best ? 'yes' : 'no',
              pass: quiz.passPercent ?? 0,
              hasPass: quiz.passPercent === null ? 'no' : 'yes',
            })}
          />
          {quiz.passPercent !== null && (
            <p className="type-caption text-text-muted m-0">
              {tr('passLine', { pass: quiz.passPercent })}
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="border-border-muted border-t pt-1">
          {/* Plegado (8/10, Jhonny): la frase y la barra ya dicen la mejor nota. */}
          <WorkshopsDisclosure label={tr('history', { count: history.length })}>
            <ol className="m-0 list-none p-0">
              {history.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link
                    href={`/aprender/examen/${a.assignmentId}/intento/${a.id}`}
                    className="type-body text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {tr('attempt', { number: a.number })}
                    <span className="sr-only"> {quiz.title}</span>
                  </Link>
                  <span className="type-caption text-text-muted tabular-nums">
                    {a.score
                      ? tr('attemptScore', {
                          percent: a.score.percent,
                          passed: a.score.passed ? 'yes' : 'no',
                        })
                      : a.status === 'GRADED'
                        ? tr('attemptHidden')
                        : t(`assessment.status.${a.status}`)}
                    {a.submittedAt ? ` · ${when(a.submittedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </WorkshopsDisclosure>
        </div>
      )}

      {action && (
        <Link
          href={action.href}
          className="type-label text-text-link min-h-touch mt-auto inline-flex items-center gap-1.5 underline underline-offset-4"
        >
          {action.label}
          <span className="sr-only"> {quiz.title}</span>
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      )}
    </article>
  );
}
