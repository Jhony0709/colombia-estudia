/**
 * El panel del estudiante: sus programas y, abajo, la ruta del elegido módulo a módulo.
 * SSOT: reference/01-routing/routes.md:27, plan/08-aprender-y-evaluar.md:12-19.
 *
 * Varias matrículas a la vez (21/9): una tarjeta por programa con su avance y su «seguir
 * con», y la ruta completa del que se elige (`?matricula=`). Antes solo se veía la más
 * reciente y las demás quedaban invisibles aunque estuvieran activas.
 *
 * Server Component entero y sin JavaScript de cliente: es una lista de enlaces con su
 * estado. El acordeón es `<details>`, que abre y cierra con teclado sin que nadie escriba
 * nada, y que funciona aunque el JavaScript falle — que en un celular de gama media con
 * datos limitados pasa.
 */

import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  getCohortOutline,
  listMyEnrollments,
  type CohortOutline,
  type MyEnrollment,
  type OutlineModule,
} from '@/features/learn/server/cohort.service';
import type { SequencedItem } from '@/features/learn/server/outline';
import { CircleCheck, Lock } from 'lucide-react';
import { FORM_ICONS, formOf, hrefFor, itemMeta } from './route-rail';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { EnrollmentSwitcher } from './enrollment-switcher';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Aprender' };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ matricula?: string | string[] }>;
}) {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const institutionId = ctx.institution.id;
  const personId = ctx.person.id;

  // Todas las matrículas (21/9): quien está en el módulo de introducción y en el
  // bachillerato tiene dos programas, y ver solo «el más reciente» escondía el otro.
  const mine = await listMyEnrollments({ institutionId, personId });

  if (mine.length === 0) {
    return (
      <Page>
        <PageHeader title={t('dashboardTitle')} />
        <EmptyState
          title={t('gate.NO_ENROLLMENT.title')}
          description={t('gate.NO_ENROLLMENT.body')}
          supportEmail={ctx.institution.supportEmail}
        />
      </Page>
    );
  }

  // La ruta que se abre abajo: la elegida en la URL (`?matricula=`) o la primera, que es la
  // activa más reciente. Un id ajeno o inventado cae en la primera, sin error: no es un
  // formulario, es una pestaña.
  const { matricula } = await searchParams;
  const picked = Array.isArray(matricula) ? matricula[0] : matricula;
  const selected = mine.find((row) => row.enrollmentId === picked) ?? mine[0]!;

  const outline = await getCohortOutline({
    institutionId,
    personId,
    enrollmentId: selected.enrollmentId,
  });

  return (
    <Page>
      <PageHeader
        title={t('dashboardTitle')}
        description={t('dashboardHint', { count: mine.length })}
      />

      {/*
        `/aprender` como «hoy» (E2, 23/9, `docs/ux/decision-estudiante-2309.md`): una sola
        zona dominante —«Continúa donde quedaste» o «Empieza por aquí»— con el selector de
        matrícula dentro cuando hay más de una, y debajo la ruta resumida: abierto el módulo
        por el que se va, los demás en una línea. Entre el 21/9 y hoy hubo una lista «Tus
        otros programas» entre la tarea y la ruta; en el teléfono dejaba la ruta a dos
        pantallas.
      */}
      <ContinueCard
        row={selected}
        switcher={
          // E2 (23/9): con dos o más matrículas, un selector en la tarjeta; con una, nada.
          // La lista «Tus otros programas» se va: dejaba la ruta a dos pantallas en móvil.
          mine.length > 1 ? (
            <EnrollmentSwitcher
              selectedId={selected.enrollmentId}
              options={mine.map((row) => ({
                enrollmentId: row.enrollmentId,
                programName: row.cohort.programName,
                code: row.cohort.code,
                cohortName: row.cohort.name,
                completed: row.progress.completed,
                total: row.progress.total,
              }))}
            />
          ) : null
        }
      />

      <RouteSection outline={outline} supportEmail={ctx.institution.supportEmail} />
    </Page>
  );
}

/**
 * La tarea de hoy, arriba del todo. Con avance: «Continúa donde quedaste» y el tema por el
 * que seguir; sin nada empezado: «Empieza por aquí», que dice qué es el primer tema, cuánto
 * dura y cómo se completa —es el momento de más abandono y no merece una pantalla aparte
 * (decisión del 23/9)—. Con un estado terminal, lo que ya decía la tarjeta.
 */
const isDayOnly = (d: Date) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

async function ContinueCard({ row, switcher }: { row: MyEnrollment; switcher: React.ReactNode }) {
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { cohort, gate, progress, resume, upcoming } = row;
  // Sin nada que abrir pero con algo por delante (23/9): decir cuál es y por qué espera.
  const waiting = !gate && !resume && upcoming ? upcoming : null;
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  const starting = !gate && progress.completed === 0;

  return (
    <section
      aria-labelledby="continuar-titulo"
      className="border-accent-base bg-surface-base rounded-card elevation-resting space-y-4 border p-5 sm:p-6"
    >
      <div className="space-y-1">
        {switcher ?? (
          <p className="type-overline text-text-muted">
            {cohort.programName} · {cohort.code}
          </p>
        )}
        <h2 id="continuar-titulo" className="type-heading text-text">
          {gate
            ? t(`gate.${gate.kind}.title`)
            : starting
              ? t('startHere.title')
              : t('continue.title')}
        </h2>
        {gate ? (
          <p className="type-body text-text-muted max-w-reading">
            {t(`gate.${gate.kind}.body`, {
              date:
                'startsOn' in gate ? gate.startsOn : 'accessUntil' in gate ? gate.accessUntil : '',
            })}
          </p>
        ) : starting && resume ? (
          <p className="type-body text-text-muted max-w-reading">
            {t('startHere.body', { how: t(`startHere.how.${formOf(resume)}`) })}
          </p>
        ) : waiting ? (
          <p className="type-body text-text-muted max-w-reading">
            {t('startHere.waiting', {
              title: waiting.title,
              reason:
                waiting.unavailableReason === 'CLOSED'
                  ? t('startHere.closed')
                  : waiting.unavailableReason === 'NOT_YET'
                    ? t('startHere.notYet', {
                        // `availableFrom` es la fecha de inicio de la cohorte (`@db.Date`,
                        // medianoche UTC) cuando la asignación viene de abrirla, y un instante
                        // cuando viene de «Actualizaciones del programa». La medianoche UTC en
                        // Bogotá es el día anterior a las 19:00: una fecha sin hora se pinta en UTC.
                        date: format.dateTime(waiting.availableFrom, {
                          dateStyle: 'long',
                          ...(isDayOnly(waiting.availableFrom) ? { timeZone: 'UTC' } : {}),
                        }),
                      })
                    : waiting.blockedBy
                      ? t('startHere.blocked', { title: waiting.blockedBy })
                      : t('startHere.unavailable'),
            })}
          </p>
        ) : null}
      </div>

      {!gate && resume && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* E0 (23/9): la acción principal de /aprender se mide (mostrada / pulsada). */}
          <PrimaryActionTracker
            screen="aprender"
            action={starting ? 'start' : 'resume'}
            assignmentId={resume.assignmentId}
            form={formOf(resume)}
            enrollmentId={row.enrollmentId}
          >
            <Button asChild>
              <Link href={hrefFor(resume)}>
                <span className="max-w-[20rem] truncate">
                  {starting
                    ? t('startHere.action', { title: resume.title })
                    : t('resumeAction', { title: resume.title })}
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </Button>
          </PrimaryActionTracker>
          <span className="type-caption text-text-muted">{itemMeta(resume, t)}</span>
        </div>
      )}

      {!gate && (
        <div className="space-y-1">
          <svg
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label={t('progressLabel', { program: cohort.programName })}
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            className="h-2 w-full overflow-hidden rounded-full"
          >
            <rect width="100" height="8" className="fill-surface-sunken" />
            <rect width={percent} height="8" className="fill-accent-base" />
          </svg>
          <p className="type-caption text-text-muted">
            {t('progress', { completed: progress.completed, total: progress.total })}
          </p>
        </div>
      )}

      {(gate?.kind === 'ACCESS_EXPIRED' || gate?.kind === 'COMPLETED') && (
        <Link
          href="/aprender/resultados"
          className="type-body text-text-link min-h-touch inline-flex items-center underline"
        >
          {t('goToResults')}
        </Link>
      )}
      {row.partnerFunded && <p className="type-caption text-text-muted">{t('partnerFunded')}</p>}
    </section>
  );
}

/** La ruta del programa elegido, o por qué no se puede recorrer. */
async function RouteSection({
  outline,
  supportEmail,
}: {
  outline: CohortOutline;
  supportEmail?: string;
}) {
  const t = await getTranslations('learn');
  const { cohort, modules, resume, upcoming, gate } = outline;
  const title = cohort ? t('routeOf', { program: cohort.programName }) : t('outlineTitle');
  // La ruta resumida, no escondida (E2, 23/9): abierto el módulo por el que se va (el del
  // ítem a retomar, o el del primero sin completar, o el primero), los demás en una línea
  // con «x de y · min». Si todo está completo, abierto el último.
  const currentModuleId = (resume ?? upcoming)?.moduleId ?? modules[modules.length - 1]?.id ?? null;

  // Los estados terminales tienen pantalla propia: enseñar una ruta que no se puede recorrer
  // es peor que explicar por qué.
  if (gate) {
    return (
      <PageSection title={title} id="ruta">
        <EmptyState
          title={t(`gate.${gate.kind}.title`)}
          description={t(`gate.${gate.kind}.body`, {
            date:
              'startsOn' in gate ? gate.startsOn : 'accessUntil' in gate ? gate.accessUntil : '',
          })}
          supportEmail={supportEmail}
        />
      </PageSection>
    );
  }

  return (
    <PageSection title={title} id="ruta">
      {modules.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <ModuleBlock
              key={module.id}
              module={module}
              resumeId={resume?.assignmentId ?? null}
              current={module.id === currentModuleId}
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}

/** Lo que el módulo cuesta y cómo va: «3 de 8 · 52 min». Los minutos, si algún ítem los trae. */
function summarize(items: SequencedItem[]) {
  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const minutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  return { completed, total: items.length, minutes };
}

/**
 * Un módulo de la ruta. Cerrado si está bloqueado entero (ningún ítem habilitado y el
 * primero espera a otro tema): abrirlo solo enseñaría una lista de «se habilita al…».
 */
async function ModuleBlock({
  module,
  resumeId,
  current,
}: {
  module: OutlineModule;
  resumeId: string | null;
  /** El módulo por el que se va (E2, 23/9): el único que se abre; los demás, resumidos. */
  current: boolean;
}) {
  const t = await getTranslations('learn');
  const { completed, total, minutes } = summarize(module.items);
  const first = module.items[0];
  const locked =
    module.items.length > 0 && module.items.every((item) => !item.enabled) && first?.blockedBy;

  return (
    <details
      open={current && !locked}
      className={cn('border-border rounded-card border p-4', locked && 'bg-surface-sunken')}
    >
      <summary className="min-h-touch flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
        <span className="type-subheading text-text inline-flex items-center gap-2">
          {locked ? (
            <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
          ) : completed === total && total > 0 ? (
            <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
          ) : null}
          {module.name}
        </span>
        {total > 0 && (
          <span className="type-caption text-text-muted">
            {locked && first?.blockedBy
              ? t('moduleLocked', { title: first.blockedBy })
              : t('moduleSummary', { completed, total, minutes })}
          </span>
        )}
      </summary>
      {module.items.length === 0 ? (
        <p className="type-body text-text-muted mt-2">{t('moduleEmpty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {module.items.map((item) => (
            // El examen de un tema (20/9) va justo debajo de su tema, un poco metido: el
            // orden ya lo dice, la sangría solo lo hace visible.
            <li
              key={item.assignmentId}
              className={cn(item.kind === 'ASSESSMENT' && item.lessonId && 'pl-6')}
            >
              <ItemRow item={item} isResume={item.assignmentId === resumeId} />
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/**
 * Una fila de la ruta: icono de la forma, título, «Vídeo · 12 min · Completado».
 *
 * El estado va en **texto** además de en el estilo, y lo bloqueado no es un enlace: un
 * enlace que no lleva a ninguna parte se anuncia como enlace y frustra a quien lo pulsa.
 * La fila por la que se retoma va resaltada y con «Reanudar»: es la única acción que el
 * estudiante tiene que encontrar sin buscar.
 */
async function ItemRow({ item, isResume }: { item: SequencedItem; isResume: boolean }) {
  const t = await getTranslations('learn');
  const Icon = FORM_ICONS[formOf(item)];

  const label = `${itemMeta(item, t)} · ${t(`status.${item.status}`)}`;

  if (!item.enabled) {
    return (
      <div className="border-border bg-surface-sunken rounded-control flex items-start gap-3 border p-3">
        <Icon aria-hidden className="text-text-muted mt-0.5 size-5 shrink-0" />
        <div>
          <p className="type-body text-text-muted">{item.title}</p>
          <p className="type-caption text-text-muted">
            {label} ·{' '}
            {item.blockedBy
              ? t('blockedBy', { title: item.blockedBy })
              : item.unavailableReason === 'NOT_YET'
                ? t('notYet')
                : t('closed')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={hrefFor(item)}
      className={cn(
        'border-border bg-surface-base hover:bg-surface-sunken min-h-touch rounded-control flex items-center gap-3 border p-3',
        isResume && 'border-accent-base'
      )}
    >
      {item.status === 'COMPLETED' ? (
        <CircleCheck aria-hidden className="text-status-success-base size-5 shrink-0" />
      ) : (
        <Icon aria-hidden className="text-text-muted size-5 shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <span className="type-body-emphasis text-text-link block underline">{item.title}</span>
        <span className="type-caption text-text-muted block">{label}</span>
      </span>
      {isResume && (
        <span className="type-caption bg-accent-base text-text-on-accent rounded-control shrink-0 px-3 py-1">
          {item.status === 'IN_PROGRESS' ? t('resumeHere') : t('startHere')}
        </span>
      )}
    </Link>
  );
}
