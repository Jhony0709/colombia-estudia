/**
 * El panel del estudiante («Student Learning Home», 27/9; rehecho el 4/10). SSOT:
 * reference/01-routing/routes.md:27, plan/08-aprender-y-evaluar.md:12-19.
 *
 * Orden (4/10): saludo → **héroe de continuar** (la actividad actual sobre el azul de marca,
 * con la portada del componente y el botón) → tres cifras con micro-gráfico (avance, tiempo,
 * días con estudio) → «Tu ritmo» y «Tus exámenes» a la izquierda, «Próximas fechas» y ayuda a
 * la derecha → la ruta como línea con cuatro estados → cursos abiertos. En el teléfono todo
 * apilado en ese orden, con las fechas antes de la ruta, que es larga.
 *
 * Varias matrículas a la vez (21/9): el selector va en el héroe y la ruta es la del elegido
 * (`?matricula=`). Server Component salvo el tooltip del gráfico; el acordeón es `<details>`,
 * que abre y cierra con teclado y aunque el JavaScript falle.
 */

import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listOpenFreeCourses } from '@/features/learn/server/catalog.service';
import { getCalendarForStudent } from '@/features/learn/server/calendar.service';
import { getLibraryForStudent } from '@/features/learn/server/library.service';
import { getStudyActivity } from '@/features/learn/server/activity.service';
import { getResultsForStudent } from '@/features/learn/server/attempt.service';
import {
  issueAfterProgress,
  listCertificatesForStudent,
} from '@/features/certificates/server/certificates.service';
import { CompletedCourses } from './completed-courses';
import { CatalogSection } from './catalog-section';
import Image from 'next/image';
import { AgendaCard, ExamsCard, HelpCard, ProgressKpis, RhythmCard } from './dashboard-cards';
import { HomeHero } from './home-hero';
import {
  getCohortOutline,
  listMyEnrollments,
  type CohortOutline,
  type MyEnrollment,
  type OutlineModule,
} from '@/features/learn/server/cohort.service';
import { workshopStart, type SequencedItem } from '@/features/learn/server/outline';
import { ArrowRight, CalendarDays, CircleCheck, FileText, Lock, Play } from 'lucide-react';
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
  const [listed, courses] = await Promise.all([
    listMyEnrollments({ institutionId, personId }),
    listOpenFreeCourses({ institutionId, personId }),
  ]);
  // Ruta terminada con la matrícula aún activa (5/10): se emite lo que toque, como en
  // «Constancias», y el héroe dice «Terminaste el programa» sin esperar al job diario.
  const done = listed.filter(
    (row) => !row.gate && !row.resume && !row.upcoming && row.progress.total > 0
  );
  for (const row of done) {
    await issueAfterProgress({ institutionId, enrollmentId: row.enrollmentId });
  }
  const mine = done.length > 0 ? await listMyEnrollments({ institutionId, personId }) : listed;

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

  const [outline, events, library, activity] = await Promise.all([
    getCohortOutline({ institutionId, personId, enrollmentId: selected.enrollmentId }),
    getCalendarForStudent({ institutionId, personId }),
    getLibraryForStudent({ institutionId, personId }),
    getStudyActivity({ institutionId, personId }),
  ]);
  // Los exámenes del programa elegido, con su mejor nota visible y su umbral (4/10). Solo si
  // la ruta tiene exámenes: la consulta de resultados recorre todas las matrículas.
  const hasExams = outline.modules.some((m) => m.items.some((i) => i.kind === 'ASSESSMENT'));
  const exams = hasExams
    ? (await getResultsForStudent({ institutionId, personId })).assessments.filter(
        (exam) => exam.cohortCode === selected.cohort.code
      )
    : [];

  const nowIso = new Date().toISOString();
  // Lo que viene (4/10): sesiones, entregas y, si no hay nada más, el fin de la cohorte o del
  // acceso, que también es una fecha que el estudiante quiere ver venir.
  const agenda = events
    .filter((e) => e.at >= nowIso)
    .slice(0, 3)
    .map((e) => ({ id: e.id, kind: e.kind, title: e.title, at: e.at, href: e.href }));
  const resources = [...library.modules.flatMap((m) => m.items), ...library.recordings].slice(0, 3);
  const current = currentModule(outline);

  // Lo terminado (5/10): con el programa elegido completado, el panel deja de ser «lo que
  // toca hoy» y pasa a ser qué sigue —los cursos abiertos— y lo que ya se hizo.
  const completedRows = mine.filter((row) => row.gate?.kind === 'COMPLETED');
  const certificates =
    completedRows.length > 0 ? await listCertificatesForStudent({ institutionId, personId }) : [];
  const finished = selected.gate?.kind === 'COMPLETED';
  const completedSection = <CompletedCourses rows={completedRows} certificates={certificates} />;

  return (
    <Page wide>
      <PageHeader
        title={t('greeting', { name: ctx.person.givenName })}
        description={
          finished
            ? t('dashboardHintDone')
            : mine.length > 1
              ? t('dashboardHintMany', { count: mine.length })
              : t('dashboardHintOne')
        }
        action={
          <p className="type-caption text-text-muted inline-flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {format.dateTime(new Date(), { dateStyle: 'full' })}
          </p>
        }
      />

      <CurrentActivity
        row={selected}
        cover={current?.coverUrl ?? null}
        moduleName={selected.resume ? (current?.name ?? null) : null}
        catalogHref={finished && courses.length > 0 ? '#cursos-abiertos' : null}
        lockedNext={
          selected.upcoming?.unavailableReason === 'LOCKED' && !selected.resume
            ? (outline.modules.find((m) => m.id === selected.upcoming?.moduleId)?.name ?? null)
            : null
        }
        switcher={
          // E2 (23/9): con dos o más matrículas, un selector en el héroe; con una, nada.
          mine.length > 1 ? (
            <EnrollmentSwitcher
              tone="on-accent"
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

      {!selected.gate && <ProgressKpis outline={outline} activity={activity} />}

      {finished && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <CatalogSection courses={courses} />
            {completedSection}
          </div>
          <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
            <AgendaCard items={agenda} />
            <HelpCard
              phone={ctx.institution.supportPhone ?? null}
              email={ctx.institution.supportEmail ?? null}
              name={ctx.person.givenName}
            />
          </aside>
        </div>
      )}

      {!finished && (
        <>
          {/* 2/3 + 1/3 en escritorio (4/10): a la izquierda cómo voy (ritmo, exámenes) y la ruta;
              a la derecha lo que viene y a quién preguntar. En el teléfono, apilado en ese orden,
              con las fechas antes de la ruta, que es larga. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0 space-y-6">
              {!selected.gate && <RhythmCard activity={activity} />}
              <ExamsCard exams={exams} />
            </div>
            <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
              <AgendaCard items={agenda} />
              <HelpCard
                phone={ctx.institution.supportPhone ?? null}
                email={ctx.institution.supportEmail ?? null}
                name={ctx.person.givenName}
              />
            </aside>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0 space-y-8">
              <RouteSection outline={outline} supportEmail={ctx.institution.supportEmail} />
              <CatalogSection courses={courses} />
              {completedSection}
            </div>
            {resources.length > 0 && (
              <aside className="min-w-0" aria-label={t('aside.resources')}>
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
              </aside>
            )}
          </div>
        </>
      )}
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

/**
 * El componente por el que se va (3/10, antes lo decidía el servicio al firmar una sola
 * portada): el del ítem a retomar, o el del primero sin completar, o el último.
 */
function currentModule(outline: CohortOutline): OutlineModule | null {
  const id = (outline.resume ?? outline.upcoming)?.moduleId ?? null;
  return (
    outline.modules.find((m) => m.id === id) ?? outline.modules[outline.modules.length - 1] ?? null
  );
}

async function CurrentActivity({
  row,
  cover,
  moduleName,
  lockedNext,
  switcher,
  catalogHref,
}: {
  row: MyEnrollment;
  cover: string | null;
  /** El componente de lo que toca, para la línea de contexto del héroe. */
  moduleName: string | null;
  /** El nombre del siguiente componente cuando lo que toca está en uno bloqueado (3/10). */
  lockedNext: string | null;
  switcher: React.ReactNode;
  /** Programa terminado y cursos abiertos (5/10): el héroe lleva a elegir el siguiente. */
  catalogHref: string | null;
}) {
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { cohort, gate, progress, resume, upcoming } = row;
  // Sin nada que abrir pero con algo por delante (23/9): decir cuál es y por qué espera.
  const waiting = !gate && !resume && upcoming ? upcoming : null;
  // Todo hecho y la matrícula aún activa (5/10): un examen final sin aprobar, o la constancia
  // por emitir. Antes el héroe decía «Continúa donde quedaste» sin botón: sin salida.
  const routeDone = !gate && !lockedNext && !resume && !upcoming && progress.total > 0;
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  const starting = !gate && progress.completed === 0;

  const body = gate
    ? t(`gate.${gate.kind}.body`, {
        date: 'startsOn' in gate ? gate.startsOn : 'accessUntil' in gate ? gate.accessUntil : '',
      })
    : lockedNext
      ? t('nextComponent.body', { module: lockedNext })
      : starting && resume
        ? t('startHere.body', { how: t(`startHere.how.${formOf(resume)}`) })
        : waiting
          ? t('startHere.waiting', {
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
            })
          : routeDone
            ? t('routeDone.body', { program: cohort.programName })
            : null;

  return (
    // El héroe ES lo que toca hoy (4/10): antes había un héroe de ánimo con su propio
    // «Continuar aprendiendo» y, debajo, esta tarjeta con otro «Continuar». En el teléfono el
    // botón quedaba tras pantalla y media. El azul de marca y la foto se quedan; el mensaje
    // ahora es la actividad.
    <section
      aria-labelledby="actual-titulo"
      className="bg-accent-base text-text-on-accent rounded-card relative overflow-hidden sm:min-h-[17rem]"
    >
      {/* La portada del componente o, sin ella, la foto de marca: decorativa (WCAG 1.1.1),
          solo desde `sm`; en el teléfono el texto y el botón van primero. */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[46%] sm:block">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <Image
            src="/photos/aprender-hero-wide.webp"
            alt=""
            width={1600}
            height={500}
            sizes="(min-width: 640px) 46vw, 0px"
            priority
            className="h-full w-full object-cover object-right-top"
          />
        )}
        <div className="hero-cover-scrim absolute inset-0" />
      </div>

      <div className="relative max-w-[36rem] space-y-5 p-6 sm:p-10">
        <div className="space-y-2">
          {switcher ?? (
            <p className="type-overline m-0 uppercase opacity-90">
              {gate
                ? cohort.programName
                : lockedNext
                  ? t('nextComponent.overline')
                  : starting
                    ? t('startHere.title')
                    : t('hero.resume')}
            </p>
          )}
          <h2 id="actual-titulo" className="type-display m-0 text-balance">
            {gate
              ? t(`gate.${gate.kind}.title`)
              : lockedNext
                ? t('nextComponent.title', { module: lockedNext })
                : resume
                  ? resume.title
                  : waiting
                    ? waiting.title
                    : routeDone
                      ? t('routeDone.title')
                      : t('continue.title')}
          </h2>
          {!gate && resume && (
            <p className="type-body m-0 flex items-start gap-2 opacity-90">
              {(() => {
                const Icon = FORM_ICONS[formOf(resume)];
                return <Icon aria-hidden className="mt-1 size-4 shrink-0" />;
              })()}
              <span className="min-w-0">
                {itemMeta(resume, t)}
                {moduleName ? ` · ${moduleName}` : ''}
              </span>
            </p>
          )}
        </div>

        {body && <p className="type-body max-w-reading m-0 opacity-90">{body}</p>}

        {!gate && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            {resume && (
              // E0 (23/9): la acción principal de /aprender se mide (mostrada / pulsada).
              <PrimaryActionTracker
                screen="aprender"
                action={starting ? 'start' : 'resume'}
                assignmentId={resume.assignmentId}
                form={formOf(resume)}
                enrollmentId={row.enrollmentId}
              >
                <Button asChild size="lg" variant="secondary">
                  <Link href={hrefFor(resume)}>
                    {starting ? t('startLabel') : t('continueLabel')}
                    <span className="sr-only"> {resume.title}</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </Link>
                </Button>
              </PrimaryActionTracker>
            )}
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <ProgressBar
                percent={percent}
                label={t('progressLabel', { program: cohort.programName })}
                tone="on-accent"
                grow
              />
              <p className="type-caption m-0 opacity-90">
                {t('hero.progress', {
                  percent,
                  completed: progress.completed,
                  total: progress.total,
                  program: cohort.programName,
                })}
              </p>
            </div>
          </div>
        )}

        {gate?.kind === 'COMPLETED' && catalogHref && (
          <Button asChild size="lg" variant="secondary">
            <a href={catalogHref}>
              {t('completed.nextCourse')}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </a>
          </Button>
        )}
        {(gate?.kind === 'ACCESS_EXPIRED' || gate?.kind === 'COMPLETED' || routeDone) && (
          <Link
            href="/aprender/resultados"
            className="type-body min-h-touch inline-flex items-center underline underline-offset-4"
          >
            {t('goToResults')}
          </Link>
        )}
        {row.partnerFunded && <p className="type-caption m-0 opacity-90">{t('partnerFunded')}</p>}
      </div>
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
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { completed, total, minutes } = summarize(module.items);
  const first = module.items[0];
  // Cerrado por el componente (3/10: operación no lo ha habilitado, o está fuera de sus
  // fechas) o por secuencia (ningún ítem habilitado y el primero espera a otro tema).
  const { access } = module;
  const closed = access.state !== 'OPEN';
  const locked =
    closed ||
    (module.items.length > 0 && module.items.every((item) => !item.enabled) && !!first?.blockedBy);
  const lockedText =
    access.state === 'LOCKED'
      ? t('moduleAccess.LOCKED')
      : access.state === 'NOT_YET'
        ? t('moduleAccess.NOT_YET', { date: format.dateTime(access.from, { dateStyle: 'long' }) })
        : access.state === 'CLOSED'
          ? t('moduleAccess.CLOSED', { date: format.dateTime(access.until, { dateStyle: 'long' }) })
          : first?.blockedBy
            ? t('moduleLocked', { title: first.blockedBy })
            : null;
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

  // El taller (asignatura) como cabecera de grupo cuando cambia (3/10): «Lengua castellana»,
  // y debajo sus temas y su cuestionario.
  const workshop = (item: SequencedItem) => workshopStart(module.items, module.items.indexOf(item));

  const row = (item: SequencedItem, index: number, last: boolean) => (
    <li key={item.assignmentId} className="relative pl-9">
      {workshop(item) && (
        <p className="type-overline text-text-muted mb-2 mt-3 first:mt-0">{workshop(item)}</p>
      )}
      {/* La línea entre puntos; el último no la lleva. */}
      {!last && (
        <span
          aria-hidden
          className={cn(
            'bg-border-muted absolute left-[0.6875rem] w-0.5',
            workshop(item) ? 'top-[3.875rem] h-[calc(100%-2.75rem)]' : 'top-8 h-[calc(100%-0.5rem)]'
          )}
        />
      )}
      <StatusDot item={item} isResume={item.assignmentId === resumeId} offset={!!workshop(item)} />
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
        {/* La portada del componente (3/10), decorativa; en gris cuando está bloqueado. */}
        {module.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
          <img
            src={module.coverUrl}
            alt=""
            className={cn(
              'bg-surface-sunken rounded-control size-12 shrink-0 object-cover',
              locked && 'opacity-60 grayscale'
            )}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="type-subheading text-text inline-flex items-center gap-2">
            {locked ? (
              <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
            ) : completed === total && total > 0 ? (
              <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
            ) : null}
            {module.name}
          </span>
          {(total > 0 || closed) && (
            <span className="type-caption text-text-muted block">
              {locked && lockedText
                ? lockedText
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
function StatusDot({
  item,
  isResume,
  offset = false,
}: {
  item: SequencedItem;
  isResume: boolean;
  /** Con cabecera de taller encima, el punto baja a la altura de la fila. */
  offset?: boolean;
}) {
  const base = cn(
    'absolute left-0 inline-flex size-6 items-center justify-center rounded-full',
    offset ? 'top-[2.625rem]' : 'top-3'
  );
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
        : item.unavailableReason === 'LOCKED'
          ? t('lockedModule')
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
