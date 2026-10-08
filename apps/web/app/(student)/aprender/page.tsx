/**
 * El panel del estudiante («Student Learning Home», 27/9; rehecho el 4/10). SSOT:
 * reference/01-routing/routes.md:27, plan/08-aprender-y-evaluar.md:12-19.
 *
 * Orden (4/10): saludo → **héroe de continuar** (la actividad actual sobre el azul de marca,
 * con la portada del componente y el botón) → tres cifras con micro-gráfico (avance, tiempo,
 * días con estudio) → «Tu ritmo» y «Tus exámenes» a la izquierda, «Próximas fechas» y ayuda a
 * la derecha → cursos abiertos. La ruta completa vive en `/aprender/curso/[enrollmentId]`
 * desde el 7/10 (Jhonny): aquí, el héroe enlaza a ella. En el teléfono todo apilado.
 *
 * Varias matrículas a la vez (21/9): el selector va en el héroe y el panel es el del elegido
 * (`?matricula=`). Server Component salvo el tooltip del gráfico.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listOpenCourses } from '@/features/learn/server/catalog.service';
import { getCalendarForStudent } from '@/features/learn/server/calendar.service';
import { getLibraryForStudent } from '@/features/learn/server/library.service';
import { getStudyActivity } from '@/features/learn/server/activity.service';
import { getResultsForStudent } from '@/features/learn/server/attempt.service';
import { issueAfterProgress } from '@/features/certificates/server/certificates.service';
import { listCompletedCourses } from '@/features/learn/server/completed.service';
import { CompletedCourses } from './completed-courses';
import { HowItWorks } from './how-it-works';
import { UnlockRequestButton } from './unlock-request-button';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { CatalogSection, FeaturedCourse } from './catalog-section';
import Image from 'next/image';
import { AgendaCard, ExamsCard, HelpCard, ProgressKpis, RhythmCard } from './dashboard-cards';
import {
  getCohortOutline,
  listMyEnrollments,
  type CohortOutline,
  type MyEnrollment,
  type OutlineModule,
} from '@/features/learn/server/cohort.service';
import { ArrowRight, CalendarDays, FileText, Play } from 'lucide-react';
import { FORM_ICONS, formOf, hrefFor, itemMeta } from './route-rail';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { EnrollmentSwitcher } from './enrollment-switcher';
import { InView } from '@/components/atoms/motion';

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
  const [listed, courses, pending] = await Promise.all([
    listMyEnrollments({ institutionId, personId }),
    listOpenCourses({ institutionId, personId }),
    // Lo pedido y sin resolver (6/10): los botones dicen «Lo pediste el …» en vez de pedir otra vez.
    listMyPendingRequests({ institutionId, personId }),
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

  const contact = { phone: ctx.institution.supportPhone ?? null, name: ctx.person.givenName };
  const help = (
    <HelpCard
      phone={ctx.institution.supportPhone ?? null}
      email={ctx.institution.supportEmail ?? null}
      name={ctx.person.givenName}
    />
  );

  if (mine.length === 0) {
    // Sin matrícula (6/10, crítica del primer día): el héroe es el curso recomendado —el
    // gratuito primero— con su botón, no una invitación a bajar a buscarlo. Debajo, el resto
    // y, al lado, cómo funciona y a quién escribir.
    const [featured, ...rest] = courses;
    return (
      <Page wide>
        <PageHeader
          title={t('greeting', { name: ctx.person.givenName })}
          description={featured ? t('catalog.firstHint') : undefined}
        />
        {featured ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0 space-y-8">
              <FeaturedCourse course={featured} contact={contact} requested={pending.enroll} />
              <CatalogSection
                courses={rest}
                contact={contact}
                requested={pending.enroll}
                title={t('catalog.more')}
              />
            </div>
            <aside
              className="motion-enter motion-order-1 min-w-0 space-y-6"
              aria-label={t('aside.label')}
            >
              <HowItWorks />
              {help}
            </aside>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <EmptyState
              title={t('gate.NO_ENROLLMENT.title')}
              description={t('gate.NO_ENROLLMENT.body')}
              supportEmail={ctx.institution.supportEmail}
            />
            <aside className="min-w-0" aria-label={t('aside.label')}>
              {help}
            </aside>
          </div>
        )}
      </Page>
    );
  }

  // La matrícula del panel: la elegida en la URL (`?matricula=`) o la primera, que es la
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
  // Un curso es un componente: también salen los terminados de un programa aún en curso.
  const completedCourses = await listCompletedCourses({ institutionId, personId });
  const finished = selected.gate?.kind === 'COMPLETED';
  // El primer día (6/10): matrícula abierta y nada completado. Sin datos, el panel de métricas
  // era un muro de ceros; lo que sirve es el siguiente paso, la ruta y cómo funciona.
  const firstDay = !selected.gate && selected.progress.completed === 0;
  // Las fechas de cierre no piden nada hoy; el primer día solo cuentan las que sí.
  const firstDayAgenda = agenda.filter((e) => e.kind !== 'COHORT_END' && e.kind !== 'ACCESS_UNTIL');
  const completedSection = <CompletedCourses courses={completedCourses} />;

  return (
    <Page wide>
      <PageHeader
        title={t('greeting', { name: ctx.person.givenName })}
        description={
          finished
            ? t('dashboardHintDone')
            : firstDay
              ? t('dashboardHintFirst')
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
        catalogHref={
          finished && courses.some((c) => !c.enrollment && !c.beforeEntry)
            ? '#cursos-abiertos'
            : null
        }
        lockedNext={
          selected.upcoming?.unavailableReason === 'LOCKED' && !selected.resume
            ? (outline.modules.find((m) => m.id === selected.upcoming?.moduleId)?.name ?? null)
            : null
        }
        lockedNextId={selected.upcoming?.moduleId ?? null}
        requestedAt={
          selected.upcoming
            ? (pending.unlock[`${selected.enrollmentId}:${selected.upcoming.moduleId}`] ?? null)
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

      {!selected.gate && !firstDay && <ProgressKpis outline={outline} activity={activity} />}

      {firstDay && (
        <div className="motion-enter motion-order-1 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            {/* Los otros cursos también el primer día (6/10): esconderlos hacía parecer
                obligatorio el que tocó en el registro. */}
            <CatalogSection
              courses={courses}
              contact={contact}
              requested={pending.enroll}
              title={t('catalog.others')}
            />
          </div>
          <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
            <HowItWorks />
            {firstDayAgenda.length > 0 && <AgendaCard items={firstDayAgenda} />}
            {help}
          </aside>
        </div>
      )}

      {finished && (
        <div className="motion-enter motion-order-1 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <CatalogSection courses={courses} contact={contact} requested={pending.enroll} />
            {completedSection}
          </div>
          <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
            <AgendaCard items={agenda} />
            {help}
          </aside>
        </div>
      )}

      {!finished && !firstDay && (
        <>
          {/* 2/3 + 1/3 en escritorio (4/10): a la izquierda cómo voy (ritmo, exámenes); a la
              derecha lo que viene y a quién preguntar. En el teléfono, apilado en ese orden. */}
          <div className="motion-enter motion-order-2 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0 space-y-6">
              {!selected.gate && <RhythmCard activity={activity} />}
              <ExamsCard exams={exams} />
            </div>
            <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
              <AgendaCard items={agenda} />
              {help}
            </aside>
          </div>

          <InView className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0 space-y-8">
              <CatalogSection courses={courses} contact={contact} requested={pending.enroll} />
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
          </InView>
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
  lockedNextId,
  requestedAt,
  switcher,
  catalogHref,
}: {
  row: MyEnrollment;
  cover: string | null;
  /** El componente de lo que toca, para la línea de contexto del héroe. */
  moduleName: string | null;
  /** El nombre del siguiente componente cuando lo que toca está en uno bloqueado (3/10). */
  lockedNext: string | null;
  /** El componente bloqueado que sigue, para pedirlo desde el héroe (6/10). */
  lockedNextId: string | null;
  /** ISO: ya lo pidió y sigue sin resolver. */
  requestedAt: string | null;
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
      // Coreografía del panel (experiencia-colombia-estudia §6): héroe → KPIs → lo demás.
      className="bg-accent-base text-text-on-accent rounded-card motion-enter-md relative overflow-hidden sm:min-h-[17rem]"
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

        {!gate && lockedNext && lockedNextId && (
          <UnlockRequestButton
            enrollmentId={row.enrollmentId}
            moduleId={lockedNextId}
            moduleName={lockedNext}
            requestedAt={requestedAt}
            tone="on-accent"
          />
        )}

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
            {starting ? (
              // El primer día una barra al 0 % no dice nada (6/10): el tamaño de la ruta, sí.
              <p className="type-caption m-0 opacity-90">
                {t('hero.routeSize', { total: progress.total, program: cohort.programName })}
              </p>
            ) : (
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
            )}
          </div>
        )}

        {/* La ruta completa vive en la página del curso (7/10). */}
        {!gate && (
          <Link
            href={`/aprender/curso/${row.enrollmentId}`}
            className="type-body min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            {t('course.seeRoute')}
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          </Link>
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
