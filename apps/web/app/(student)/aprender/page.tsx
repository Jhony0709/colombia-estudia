/**
 * El panel del estudiante («Student Learning Home», 27/9): en pocos segundos, dónde estoy, qué
 * hago ahora y cuánto llevo. SSOT: reference/01-routing/routes.md:27, plan/08-aprender-y-evaluar.md:12-19.
 *
 * Orden (del diseño aprobado el 27/9): hero estático → saludo → «Actividad actual» con el
 * botón «Continuar» (el título fuera del botón) → una franja de progreso (50 % · 4 de 8 ·
 * ~40 min) → la ruta como línea con cuatro estados. En escritorio (`lg`) una columna a la
 * derecha con eventos próximos, recursos y ayuda, cada uno solo si hay algo que enseñar; en
 * el teléfono todo apilado y la ruta abierta, con «Ver N restantes» para lo que sigue.
 *
 * Varias matrículas a la vez (21/9): el selector dentro de «Actividad actual» y la ruta del
 * elegido (`?matricula=`). Server Component entero; el acordeón es `<details>`, que abre y
 * cierra con teclado y aunque el JavaScript falle.
 */

import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listOpenFreeCourses } from '@/features/learn/server/catalog.service';
import { getCalendarForStudent } from '@/features/learn/server/calendar.service';
import { getLibraryForStudent } from '@/features/learn/server/library.service';
import { CatalogSection } from './catalog-section';
import { HomeHero } from './home-hero';
import {
  getCohortOutline,
  listMyEnrollments,
  type CohortOutline,
  type MyEnrollment,
  type OutlineModule,
} from '@/features/learn/server/cohort.service';
import type { SequencedItem } from '@/features/learn/server/outline';
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  FileText,
  LifeBuoy,
  Lock,
  Play,
  Video,
} from 'lucide-react';
import { FORM_ICONS, formOf, hrefFor, itemMeta } from './route-rail';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { EnrollmentSwitcher } from './enrollment-switcher';

export const metadata: Metadata = { title: 'Aprender' };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ matricula?: string | string[] }>;
}) {
  const ctx = await getRequestContext();
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);

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
  // Y los cursos gratuitos abiertos en los que no está (25/9): la puerta para quien se
  // registró antes de que existiera la cohorte de introducción, y para el siguiente curso.
  const [mine, courses] = await Promise.all([
    listMyEnrollments({ institutionId, personId }),
    listOpenFreeCourses({ institutionId, personId }),
  ]);

  if (mine.length === 0) {
    // Sin matrícula el hero también está (27/9, Jhonny): es la misma casa, con la
    // invitación a elegir un curso en vez de a continuar.
    return (
      <Page>
        <HomeHero href={courses.length > 0 ? '#cursos-abiertos' : null} variant="start" />
        <PageHeader
          title={t('dashboardTitle')}
          description={courses.length > 0 ? t('catalog.noEnrollmentHint') : undefined}
        />
        {courses.length > 0 ? (
          <CatalogSection courses={courses} />
        ) : (
          <EmptyState
            title={t('gate.NO_ENROLLMENT.title')}
            description={t('gate.NO_ENROLLMENT.body')}
            supportEmail={ctx.institution.supportEmail}
          />
        )}
      </Page>
    );
  }

  // La ruta que se abre abajo: la elegida en la URL (`?matricula=`) o la primera, que es la
  // activa más reciente. Un id ajeno o inventado cae en la primera, sin error: no es un
  // formulario, es una pestaña.
  const { matricula } = await searchParams;
  const picked = Array.isArray(matricula) ? matricula[0] : matricula;
  const selected = mine.find((row) => row.enrollmentId === picked) ?? mine[0]!;

  const [outline, events, library] = await Promise.all([
    getCohortOutline({ institutionId, personId, enrollmentId: selected.enrollmentId }),
    getCalendarForStudent({ institutionId, personId }),
    getLibraryForStudent({ institutionId, personId }),
  ]);

  const nowIso = new Date().toISOString();
  // Solo lo que viene y es un evento (27/9): sesiones en vivo y entregas de examen. Las
  // fechas de la cohorte (inicio, fin, acceso) ya están en el calendario y aquí serían ruido;
  // y una tarjeta con «nada para hoy» es peor que ninguna.
  const upcomingEvents = events
    .filter((e) => e.at >= nowIso && (e.kind === 'LIVE_SESSION' || e.kind === 'ASSESSMENT_DUE'))
    .slice(0, 3);
  const resources = [...library.modules.flatMap((m) => m.items), ...library.recordings].slice(0, 3);

  const resumeHref = selected.gate ? null : selected.resume ? hrefFor(selected.resume) : '#ruta';

  return (
    <Page wide>
      <HomeHero href={resumeHref} />

      <PageHeader
        title={t('greeting', { name: ctx.person.givenName })}
        description={t('dashboardHint', { count: mine.length })}
        action={
          <p className="type-caption text-text-muted inline-flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {format.dateTime(new Date(), { dateStyle: 'full' })}
          </p>
        }
      />

      {/* 8/4 en escritorio (27/9): lo que hay que hacer a la izquierda; a la derecha lo que
          acompaña. En el teléfono, apilado en ese mismo orden. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-8">
          <CurrentActivity
            row={selected}
            cover={outline.modules.find((m) => m.coverUrl !== null)?.coverUrl ?? null}
            switcher={
              // E2 (23/9): con dos o más matrículas, un selector en la tarjeta; con una, nada.
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

          {!selected.gate && (
            <ProgressStrip outline={outline} programName={selected.cohort.programName} />
          )}

          <RouteSection outline={outline} supportEmail={ctx.institution.supportEmail} />

          <CatalogSection courses={courses} />
        </div>

        <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
          {upcomingEvents.length > 0 && (
            <SideCard
              title={t('aside.events')}
              moreHref="/aprender/calendario"
              moreLabel={t('aside.calendar')}
            >
              <ul className="m-0 list-none space-y-3 p-0">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <span className="bg-status-info-muted text-status-info-base rounded-control inline-flex size-9 shrink-0 items-center justify-center">
                      {event.kind === 'LIVE_SESSION' ? (
                        <Video aria-hidden className="size-4" />
                      ) : (
                        <CalendarDays aria-hidden className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="type-body-emphasis text-text-link block underline"
                        >
                          {event.title}
                        </Link>
                      ) : (
                        <span className="type-body-emphasis text-text block">{event.title}</span>
                      )}
                      <span className="type-caption text-text-muted block">
                        {format.dateTime(new Date(event.at), {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          ...(event.kind === 'LIVE_SESSION'
                            ? { hour: 'numeric', minute: '2-digit' }
                            : {}),
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </SideCard>
          )}

          {resources.length > 0 && (
            <SideCard
              title={t('aside.resources')}
              moreHref="/aprender/biblioteca"
              moreLabel={t('aside.library')}
            >
              <ul className="m-0 list-none space-y-3 p-0">
                {resources.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span className="bg-surface-sunken text-text-muted rounded-control inline-flex size-9 shrink-0 items-center justify-center">
                      {item.kind === 'RECORDING' ? (
                        <Play aria-hidden className="size-4" />
                      ) : (
                        <FileText aria-hidden className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <a
                        href={item.href}
                        className="type-body-emphasis text-text-link block underline"
                      >
                        {item.title}
                      </a>
                      <span className="type-caption text-text-muted block">
                        {t(`aside.kind.${item.kind}`)}
                        {item.lessonTitle ? ` · ${item.lessonTitle}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </SideCard>
          )}

          {ctx.institution.supportEmail && (
            <SideCard title={t('aside.help')}>
              <div className="flex items-start gap-3">
                <span className="bg-status-info-muted text-status-info-base rounded-control inline-flex size-9 shrink-0 items-center justify-center">
                  <LifeBuoy aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 space-y-3">
                  <p className="type-body text-text-muted m-0">{t('aside.helpBody')}</p>
                  <Button asChild variant="secondary">
                    <a href={`mailto:${ctx.institution.supportEmail}`}>{t('aside.contact')}</a>
                  </Button>
                </div>
              </div>
            </SideCard>
          )}
        </aside>
      </div>
    </Page>
  );
}

/** Una tarjeta de la columna derecha: título, enlace «Ver todo» opcional, contenido. */
function SideCard({
  title,
  moreHref,
  moreLabel,
  children,
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  const id = `lateral-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="bg-surface-base rounded-card elevation-resting space-y-4 p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="type-body-emphasis text-text m-0">
          {title}
        </h2>
        {moreHref && moreLabel && (
          <Link
            href={moreHref}
            className="type-caption text-text-link inline-flex items-center gap-1 underline"
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

/**
 * «Actividad actual» (27/9, del diseño aprobado): lo que toca hoy, con el título fuera del
 * botón —el botón dice la acción, «Continuar» o «Empezar»—, el componente, «Actividad ·
 * 10 min», la barra del componente y la portada del componente si la hay. Sin nada empezado
 * es «Empieza por aquí» (decisión del 23/9: el momento de más abandono no merece una pantalla
 * aparte); con un estado terminal, lo que ya decía la tarjeta.
 */
const isDayOnly = (d: Date) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

async function CurrentActivity({
  row,
  cover,
  switcher,
}: {
  row: MyEnrollment;
  cover: string | null;
  switcher: React.ReactNode;
}) {
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { cohort, gate, progress, resume, upcoming } = row;
  // Sin nada que abrir pero con algo por delante (23/9): decir cuál es y por qué espera.
  const waiting = !gate && !resume && upcoming ? upcoming : null;
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  const starting = !gate && progress.completed === 0;

  return (
    <section
      aria-labelledby="actual-titulo"
      className="bg-surface-base rounded-card elevation-resting p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        {/* La portada del componente, decorativa: el nombre va al lado (WCAG 1.1.1). */}
        {cover && !gate && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
          <img
            src={cover}
            alt=""
            className="bg-surface-sunken rounded-card aspect-[16/9] w-full shrink-0 object-cover sm:aspect-[4/5] sm:w-40"
          />
        )}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            {switcher ?? (
              <p className="type-overline text-status-info-base m-0 uppercase">
                {gate ? cohort.programName : starting ? t('startHere.title') : t('currentActivity')}
              </p>
            )}
            <h2 id="actual-titulo" className="type-heading text-text m-0">
              {gate
                ? t(`gate.${gate.kind}.title`)
                : resume
                  ? resume.title
                  : waiting
                    ? waiting.title
                    : t('continue.title')}
            </h2>
            {!gate && <p className="type-body text-text-muted m-0">{cohort.programName}</p>}
            {gate ? (
              <p className="type-body text-text-muted max-w-reading m-0">
                {t(`gate.${gate.kind}.body`, {
                  date:
                    'startsOn' in gate
                      ? gate.startsOn
                      : 'accessUntil' in gate
                        ? gate.accessUntil
                        : '',
                })}
              </p>
            ) : starting && resume ? (
              <p className="type-body text-text-muted max-w-reading m-0">
                {t('startHere.body', { how: t(`startHere.how.${formOf(resume)}`) })}
              </p>
            ) : waiting ? (
              <p className="type-body text-text-muted max-w-reading m-0">
                {t('startHere.waiting', {
                  title: waiting.title,
                  reason:
                    waiting.unavailableReason === 'CLOSED'
                      ? t('startHere.closed')
                      : waiting.unavailableReason === 'NOT_YET'
                        ? t('startHere.notYet', {
                            // `availableFrom` es la fecha de inicio de la cohorte (`@db.Date`,
                            // medianoche UTC) cuando la asignación viene de abrirla, y un
                            // instante cuando viene de «Actualizaciones del programa».
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
            <p className="type-caption text-text-muted m-0 inline-flex items-center gap-2">
              {(() => {
                const Icon = FORM_ICONS[formOf(resume)];
                return <Icon aria-hidden className="size-4 shrink-0" />;
              })()}
              {itemMeta(resume, t)}
            </p>
          )}

          {!gate && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <ProgressBar
                    percent={percent}
                    label={t('progressLabel', { program: cohort.programName })}
                    className="flex-1"
                  />
                  <span className="type-caption text-text tabular-nums">{percent} %</span>
                </div>
                <p className="type-caption text-text-muted m-0">
                  {t('progress', { completed: progress.completed, total: progress.total })}
                </p>
              </div>
              {resume && (
                // E0 (23/9): la acción principal de /aprender se mide (mostrada / pulsada).
                <PrimaryActionTracker
                  screen="aprender"
                  action={starting ? 'start' : 'resume'}
                  assignmentId={resume.assignmentId}
                  form={formOf(resume)}
                  enrollmentId={row.enrollmentId}
                >
                  <Button asChild size="lg">
                    <Link href={hrefFor(resume)}>
                      {starting ? t('startLabel') : t('continueLabel')}
                      <span className="sr-only"> {resume.title}</span>
                      <ArrowRight aria-hidden className="size-4 shrink-0" />
                    </Link>
                  </Button>
                </PrimaryActionTracker>
              )}
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
          {row.partnerFunded && (
            <p className="type-caption text-text-muted m-0">{t('partnerFunded')}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Una franja con tres cifras (27/9): lo que llevas, cuántas actividades, cuánto queda. Una
 * sola superficie y no tres tarjetas —el propio diseño pide evitar el «dashboarditis»—. Los
 * minutos que quedan son la suma de `estimatedMinutes` de lo no completado; si nada los
 * trae, la cifra no se inventa: se omite.
 */
async function ProgressStrip({
  outline,
  programName,
}: {
  outline: CohortOutline;
  programName: string;
}) {
  const t = await getTranslations('learn.strip');
  const items = outline.modules.flatMap((m) => m.items);
  const total = items.length;
  const completed = items.filter((i) => i.status === 'COMPLETED').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const remaining = items
    .filter((i) => i.status !== 'COMPLETED')
    .reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0);
  if (total === 0) return null;

  const cells: Array<{ value: string; label: string }> = [
    { value: `${percent} %`, label: t('completed', { program: programName }) },
    { value: `${completed} / ${total}`, label: t('activities') },
    ...(remaining > 0 ? [{ value: `~${remaining} min`, label: t('remaining') }] : []),
  ];

  return (
    <dl
      aria-label={t('label')}
      className="bg-surface-base rounded-card elevation-resting divide-border-muted m-0 grid grid-cols-3 divide-x p-2"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="px-4 py-3 text-center">
          <dd className="type-heading text-text m-0 tabular-nums">{cell.value}</dd>
          <dt className="type-caption text-text-muted m-0">{cell.label}</dt>
        </div>
      ))}
    </dl>
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
 * Un módulo de la ruta como línea (27/9, del diseño aprobado): una superficie por componente
 * —nombre, «4 de 8 · 60 min», barra— y debajo los ítems unidos por una línea vertical con un
 * punto por estado: completado (check verde), actual (punto de acento y fondo tintado),
 * disponible (aro neutro) y bloqueado (candado). Sin borde por ítem: el ritmo lo da la línea.
 *
 * Cerrado si está bloqueado entero (ningún ítem habilitado y el primero espera a otro tema):
 * abrirlo solo enseñaría una lista de «se habilita al…». Lo que sigue al ítem actual y a su
 * siguiente va en «Ver N restantes», plegado: en el teléfono, ocho filas eran dos pantallas.
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
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Lo visible sin plegar: hasta el ítem actual (o el primero sin completar) y uno más.
  const focusIndex = Math.max(
    module.items.findIndex((item) => item.assignmentId === resumeId),
    module.items.findIndex((item) => item.status !== 'COMPLETED')
  );
  const visibleUntil = focusIndex < 0 ? module.items.length : focusIndex + 2;
  const shown = module.items.slice(0, visibleUntil);
  const rest = module.items.slice(visibleUntil);
  const firstBlockedId = module.items.find((i) => !i.enabled)?.assignmentId ?? null;

  const row = (item: SequencedItem, index: number, last: boolean) => (
    <li key={item.assignmentId} className="relative pl-9">
      {/* La línea entre puntos; el último no la lleva. */}
      {!last && (
        <span
          aria-hidden
          className="bg-border-muted absolute left-[0.6875rem] top-8 h-[calc(100%-0.5rem)] w-0.5"
        />
      )}
      <StatusDot item={item} isResume={item.assignmentId === resumeId} />
      <ItemRow
        item={item}
        isResume={item.assignmentId === resumeId}
        showReason={item.assignmentId === firstBlockedId}
        nested={item.kind === 'ASSESSMENT' && !!item.lessonId}
      />
    </li>
  );

  return (
    <details
      open={current && !locked}
      className={cn(
        'bg-surface-base rounded-card elevation-resting p-4 sm:p-5',
        locked && 'bg-surface-sunken'
      )}
    >
      <summary className="min-h-touch flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="type-subheading text-text inline-flex items-center gap-2">
            {locked ? (
              <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
            ) : completed === total && total > 0 ? (
              <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
            ) : null}
            {module.name}
          </span>
          {total > 0 && (
            <span className="type-caption text-text-muted block">
              {locked && first?.blockedBy
                ? t('moduleLocked', { title: first.blockedBy })
                : t('moduleSummary', { completed, total, minutes })}
            </span>
          )}
        </span>
        {total > 0 && !locked && (
          <span className="flex w-40 items-center gap-2">
            <ProgressBar
              percent={percent}
              label={t('rail.progressLabel', { module: module.name })}
              className="flex-1"
            />
            <span className="type-caption text-text-muted whitespace-nowrap tabular-nums">
              {percent} %
            </span>
          </span>
        )}
      </summary>
      {/* De qué va el componente (25/9), si el equipo lo escribió. */}
      {module.description && (
        <p className="type-body text-text-muted max-w-reading mt-3">{module.description}</p>
      )}
      {module.items.length === 0 ? (
        <p className="type-body text-text-muted mt-2">{t('moduleEmpty')}</p>
      ) : (
        <>
          <ul className="m-0 mt-4 list-none space-y-1 p-0">
            {shown.map((item, index) =>
              row(item, index, rest.length === 0 && index === shown.length - 1)
            )}
          </ul>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="type-caption text-text-link min-h-touch flex cursor-pointer items-center gap-2 pl-9">
                {t('showRest', { count: rest.length })}
              </summary>
              <ul className="m-0 mt-1 list-none space-y-1 p-0">
                {rest.map((item, index) => row(item, index, index === rest.length - 1))}
              </ul>
            </details>
          )}
        </>
      )}
    </details>
  );
}

/** El punto de la línea: uno por estado, y siempre con icono, no solo color. */
function StatusDot({ item, isResume }: { item: SequencedItem; isResume: boolean }) {
  const base = 'absolute left-0 top-3 inline-flex size-6 items-center justify-center rounded-full';
  if (item.status === 'COMPLETED') {
    return (
      <span aria-hidden className={cn(base, 'bg-status-success-muted text-status-success-base')}>
        <CircleCheck className="size-4" />
      </span>
    );
  }
  if (isResume) {
    return (
      <span aria-hidden className={cn(base, 'bg-accent-base text-text-on-accent')}>
        <Play className="size-3 fill-current" />
      </span>
    );
  }
  if (!item.enabled) {
    return (
      <span aria-hidden className={cn(base, 'bg-surface-sunken text-text-muted')}>
        <Lock className="size-3.5" />
      </span>
    );
  }
  return <span aria-hidden className={cn(base, 'border-border bg-surface-base border-2')} />;
}

/**
 * Una fila de la ruta: forma, título, «Vídeo · 12 min · Completado». El estado va en
 * **texto** además de en el punto, y lo bloqueado no es un enlace: un enlace que no lleva a
 * ninguna parte se anuncia como enlace y frustra a quien lo pulsa. La fila actual va sobre
 * fondo tintado con su «Continuar»: es la única acción que hay que encontrar sin buscar.
 */
async function ItemRow({
  item,
  isResume,
  showReason,
  nested,
}: {
  item: SequencedItem;
  isResume: boolean;
  /** Decir por qué está bloqueado; los siguientes de la misma fila de bloqueados no lo repiten. */
  showReason: boolean;
  /** El examen de un tema (20/9) va justo debajo de su tema, un poco metido. */
  nested: boolean;
}) {
  const t = await getTranslations('learn');
  const Icon = FORM_ICONS[formOf(item)];
  const label = `${itemMeta(item, t)} · ${t(`status.${item.status}`)}`;

  if (!item.enabled) {
    const reason = item.blockedBy
      ? t('blockedBy', { title: item.blockedBy })
      : item.unavailableReason === 'NOT_YET'
        ? t('notYet')
        : t('closed');
    return (
      <div className={cn('rounded-control flex items-start gap-3 px-3 py-2', nested && 'ml-4')}>
        <Icon aria-hidden className="text-text-subtle mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="type-body text-text-muted m-0">{item.title}</p>
          <p className="type-caption text-text-muted m-0">
            {label}
            {showReason ? ` · ${reason}` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={hrefFor(item)}
      className={cn(
        'hover:bg-surface-sunken rounded-control min-h-touch flex items-center gap-3 px-3 py-2',
        nested && 'ml-4',
        isResume && 'bg-status-info-muted hover:bg-status-info-muted'
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-5 shrink-0', isResume ? 'text-status-info-base' : 'text-text-muted')}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'type-body block',
            isResume
              ? 'type-body-emphasis text-text-link'
              : item.status === 'COMPLETED'
                ? 'text-text-muted'
                : 'text-text'
          )}
        >
          {item.title}
        </span>
        <span className="type-caption text-text-muted block">{label}</span>
      </span>
      {isResume && (
        <span className="type-label bg-accent-base text-text-on-accent rounded-control inline-flex shrink-0 items-center gap-1 px-3 py-1.5">
          {item.status === 'IN_PROGRESS' ? t('continueLabel') : t('startLabel')}
          <ArrowRight aria-hidden className="size-3.5" />
        </span>
      )}
    </Link>
  );
}
