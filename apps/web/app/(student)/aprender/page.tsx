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
import { getStudyActivity } from '@/features/learn/server/activity.service';
import { getResultsForStudent } from '@/features/learn/server/attempt.service';
import { issueAfterProgress } from '@/features/certificates/server/certificates.service';
import { listCompletedCourses } from '@/features/learn/server/completed.service';
import { CompletedCourses } from './completed-courses';
import { HowItWorks } from './how-it-works';
import { UnlockRequestButton } from './unlock-request-button';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { CatalogSection, FeaturedCourse } from './catalog-section';
import { KeepLearningHero } from './keep-learning-hero';
import { AgendaCard, ExamsCard, HelpCard } from './dashboard-cards';
import {
  ExploreTile,
  HelpTile,
  NextTile,
  NoPlanTile,
  PaymentTile,
  RouteTile,
  StageTile,
  WeekTile,
} from './bento-tiles';
import {
  getCohortOutline,
  listMyEnrollments,
  type CohortOutline,
  type MyEnrollment,
  type OutlineModule,
} from '@/features/learn/server/cohort.service';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { FORM_ICONS, formOf, hrefFor, itemMeta } from './route-rail';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Button } from '@/components/atoms/button';
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { EnrollmentSwitcher } from './enrollment-switcher';
import { InView } from '@/components/atoms/motion';
import { cn } from '@/lib/utils';
import { listOwnAccounts } from '@/features/billing/server/account.service';
import type { StageInstallment } from '@/features/billing/server/stage-installments';

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
  // Solo vistas de estudiante (31/10): sin catálogo, que inscribiría de verdad al admin.
  const catalog = mine.length > 0 && mine.every((row) => row.preview) ? [] : courses;

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

  const [outline, events, activity] = await Promise.all([
    getCohortOutline({ institutionId, personId, enrollmentId: selected.enrollmentId }),
    getCalendarForStudent({ institutionId, personId }),
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

  // La cuenta de la matrícula elegida (20/11): qué debo y qué abre, sin salir del inicio.
  const billingScopes = ctx.capabilities.get('billing.read.own') ?? [];
  const accounts =
    billingScopes.length > 0 ? await listOwnAccounts({ institutionId, scopes: billingScopes }) : [];
  const account = accounts.find((a) => a.enrollmentId === selected.enrollmentId) ?? null;
  // Los cursos abiertos en los que no está: se exploran en su pantalla, no aquí.
  const openCourses = catalog.filter((c) => !c.enrollment && !c.beforeEntry).length;

  const nowIso = new Date().toISOString();
  // Lo que viene (4/10): sesiones, entregas y, si no hay nada más, el fin de la cohorte o del
  // acceso, que también es una fecha que el estudiante quiere ver venir.
  const agenda = events
    .filter((e) => e.at >= nowIso)
    .slice(0, 3)
    .map((e) => ({ id: e.id, kind: e.kind, title: e.title, at: e.at, href: e.href }));
  const current = currentModule(outline);

  // Lo terminado (5/10): con el programa elegido completado, el panel deja de ser «lo que
  // toca hoy» y pasa a ser qué sigue —los cursos abiertos— y lo que ya se hizo.
  // Un curso es un componente: también salen los terminados de un programa aún en curso.
  const completedCourses = await listCompletedCourses({ institutionId, personId });
  const finished = selected.gate?.kind === 'COMPLETED';
  // El primer día (6/10): matrícula abierta y nada completado. Sin datos, el panel de métricas
  // era un muro de ceros; lo que sirve es el siguiente paso, la ruta y cómo funciona.
  const firstDay = !selected.gate && selected.progress.completed === 0;
  // Lo que viene: primero lo que pide algo; los cierres de cohorte y de acceso, si no hay más.
  const nextItem = agenda.find((e) => e.kind !== 'COHORT_END' && e.kind !== 'ACCESS_UNTIL') ?? null;
  // Sin nada que pida algo, el fin de la cohorte no aporta: ahí van los otros cursos (20/11).
  const exploreInNext = Boolean(account) && !nextItem && openCourses > 0;
  const exploreBelow = Boolean(account) && Boolean(nextItem) && openCourses > 0;
  // Exámenes del inicio: solo los que se pueden presentar o ya tienen nota (20/11).
  const examsNow = exams.filter((exam) => exam.best || exam.enabled);
  // Sin cuenta ni cursos abiertos, la ayuda sube a ese hueco y la ruta va a lo ancho.
  const helpUp = !account && !selected.awaitingPlan && openCourses === 0;
  const helpTile = (
    <HelpTile
      phone={ctx.institution.supportPhone ?? null}
      email={ctx.institution.supportEmail ?? null}
      name={ctx.person.givenName}
      className={helpUp ? 'max-lg:order-last' : undefined}
    />
  );
  const completedSection = <CompletedCourses courses={completedCourses} />;
  const currentIndex = current ? outline.modules.findIndex((m) => m.id === current.id) : -1;
  // E2 (23/9): con dos o más matrículas, un selector en el héroe; con una, nada.
  const switcher =
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
    ) : null;

  return (
    <Page wide>
      <PageHeader
        title={t('greeting', { name: ctx.person.givenName })}
        description={
          // Terminado: lo dice el héroe (8/10).
          finished
            ? undefined
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

      {finished ? (
        // Terminado (8/10): el héroe invita a elegir el siguiente curso.
        <KeepLearningHero
          program={selected.cohort.programName}
          openCourses={courses.filter((c) => !c.enrollment && !c.beforeEntry).length}
          switcher={switcher}
        />
      ) : (
        // El inicio en grid (20/11, maqueta «Inicio A · Foco»): lo que toca hoy en grande y,
        // al lado, módulos chicos que responden una pregunta cada uno.
        <section
          aria-label={t('tiles.label')}
          className="motion-enter grid gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(11.5rem,auto)] lg:grid-cols-4"
        >
          <div className="sm:col-span-2 lg:row-span-2">
            <CurrentActivity
              row={selected}
              moduleName={selected.resume ? (current?.name ?? null) : null}
              steps={selected.resume && current ? current.items : null}
              lockedNext={
                selected.upcoming?.unavailableReason === 'LOCKED' && !selected.resume
                  ? (outline.modules.find((m) => m.id === selected.upcoming?.moduleId)?.name ??
                    null)
                  : null
              }
              lockedNextId={selected.upcoming?.moduleId ?? null}
              lockedInstallment={
                outline.modules.find((m) => m.id === selected.upcoming?.moduleId)?.installment ??
                null
              }
              requestedAt={
                selected.upcoming
                  ? (pending.unlock[`${selected.enrollmentId}:${selected.upcoming.moduleId}`] ??
                    null)
                  : null
              }
              switcher={switcher}
            />
          </div>
          {current && currentIndex >= 0 && !selected.gate && (
            <StageTile module={current} index={currentIndex} total={outline.modules.length} />
          )}
          {account ? (
            <PaymentTile account={account} />
          ) : selected.awaitingPlan ? (
            <NoPlanTile />
          ) : openCourses > 0 ? (
            <ExploreTile count={openCourses} />
          ) : (
            helpTile
          )}
          {!selected.gate && <WeekTile activity={activity} />}
          {exploreInNext ? (
            <ExploreTile count={openCourses} />
          ) : (
            <NextTile item={nextItem ?? agenda[0] ?? null} />
          )}
          {outline.enrollmentId && outline.modules.length > 1 && (
            <RouteTile
              modules={outline.modules}
              currentId={current?.id ?? null}
              enrollmentId={outline.enrollmentId}
              programName={selected.cohort.programName}
              className={cn('sm:col-span-2', helpUp ? 'lg:col-span-4' : 'lg:col-span-3')}
            />
          )}
          {!helpUp && helpTile}
        </section>
      )}

      {firstDay && <HowItWorks />}

      {finished && (
        <div className="motion-enter motion-order-1 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <CatalogSection courses={catalog} contact={contact} requested={pending.enroll} />
            {completedSection}
          </div>
          <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
            <AgendaCard items={agenda} />
            {help}
          </aside>
        </div>
      )}

      {!finished && (examsNow.length > 0 || completedCourses.length > 0 || exploreBelow) && (
        <InView className="space-y-8">
          <ExamsCard exams={examsNow} />
          {exploreBelow && <ExploreTile count={openCourses} />}
          {completedSection}
        </InView>
      )}
    </Page>
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
  moduleName,
  lockedNext,
  lockedNextId,
  lockedInstallment,
  requestedAt,
  switcher,
  steps,
}: {
  row: MyEnrollment;
  /** El componente de lo que toca, para la línea de contexto del héroe. */
  moduleName: string | null;
  /** El nombre del siguiente componente cuando lo que toca está en uno bloqueado (3/10). */
  lockedNext: string | null;
  /** El componente bloqueado que sigue, para pedirlo desde el héroe (6/10). */
  lockedNextId: string | null;
  /** La cuota que abre ese componente (20/11): se paga, no se pide. */
  lockedInstallment: StageInstallment | null;
  /** ISO: ya lo pidió y sigue sin resolver. */
  requestedAt: string | null;
  switcher: React.ReactNode;
  /** Los pasos del componente por el que va (8/10): la tira de avance del héroe. */
  steps: OutlineModule['items'] | null;
}) {
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { cohort, gate, progress, resume, upcoming } = row;
  // Sin nada que abrir pero con algo por delante (23/9): decir cuál es y por qué espera.
  const waiting = !gate && !resume && upcoming ? upcoming : null;
  // Todo hecho y la matrícula aún activa (5/10): un examen final sin aprobar, o la constancia
  // por emitir. Antes el héroe decía «Continúa donde quedaste» sin botón: sin salida.
  const routeDone = !gate && !lockedNext && !resume && !upcoming && progress.total > 0;
  const starting = !gate && progress.completed === 0;
  // Dónde está dentro del componente (8/10): «paso 2 de 6», con una tira de segmentos.
  const stepIndex =
    resume && steps ? steps.findIndex((i) => i.assignmentId === resume.assignmentId) : -1;
  const strip = Boolean(!gate && resume && steps && stepIndex >= 0 && steps.length <= 24);

  const body = gate
    ? t(`gate.${gate.kind}.body`, {
        date: 'startsOn' in gate ? gate.startsOn : 'accessUntil' in gate ? gate.accessUntil : '',
      })
    : lockedNext
      ? lockedInstallment
        ? t('nextComponent.payBody', {
            module: lockedNext,
            position: lockedInstallment.position,
            amount: format.number(lockedInstallment.amount, {
              style: 'currency',
              currency: 'COP',
              maximumFractionDigits: 0,
            }),
          })
        : t('nextComponent.body', { module: lockedNext })
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
    // El módulo grande del grid (20/11): lo que toca hoy y un botón. Sin foto ni párrafo de
    // arranque; el avance del programa lo dicen los módulos de al lado.
    <section
      aria-labelledby="actual-titulo"
      className="bg-accent-base text-text-on-accent rounded-card border-brand-yellow motion-enter-md flex h-full flex-col justify-between gap-6 border-b-[6px] p-6 sm:p-8"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          {switcher ?? (
            <p className="type-overline m-0 uppercase opacity-90">
              {gate
                ? cohort.programName
                : lockedNext
                  ? t('nextComponent.overline')
                  : strip && steps
                    ? t('hero.step', {
                        module: moduleName ?? '',
                        current: stepIndex + 1,
                        total: steps.length,
                      })
                    : starting
                      ? t('startHere.title')
                      : t('hero.resume')}
            </p>
          )}
          <h2 id="actual-titulo" className="type-display m-0 text-balance">
            {gate
              ? t(`gate.${gate.kind}.title`)
              : lockedNext
                ? lockedInstallment
                  ? t('nextComponent.payTitle', { module: lockedNext })
                  : t('nextComponent.title', { module: lockedNext })
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
                {/* El taller; el componente lo dice la tira de pasos. */}
                {resume.subjectName
                  ? ` · ${resume.subjectName}`
                  : !strip && moduleName
                    ? ` · ${moduleName}`
                    : ''}
              </span>
            </p>
          )}
        </div>

        {body && <p className="type-body max-w-reading m-0 opacity-90">{body}</p>}

        {!gate && lockedNext && lockedInstallment && (
          <Button asChild size="lg" variant="secondary">
            <Link href="/aprender/mi-cuenta">
              {t('payInstallment', { position: lockedInstallment.position })}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </Button>
        )}

        {!gate && lockedNext && lockedNextId && !lockedInstallment && (
          <UnlockRequestButton
            enrollmentId={row.enrollmentId}
            moduleId={lockedNextId}
            moduleName={lockedNext}
            requestedAt={requestedAt}
            tone="on-accent"
          />
        )}

        {strip && steps && (
          <div>
            {/* Hecho en amarillo (el sol de la marca), el actual en blanco, lo demás tenue. */}
            <ol aria-hidden="true" className="m-0 flex list-none gap-1 p-0">
              {steps.map((step, i) => (
                <li
                  key={step.assignmentId}
                  className={cn(
                    'h-1.5 max-w-10 flex-1 rounded-full',
                    i === stepIndex
                      ? 'bg-text-on-accent'
                      : step.status === 'COMPLETED'
                        ? 'bg-brand-yellow'
                        : 'bg-text-on-accent opacity-30'
                  )}
                />
              ))}
            </ol>
          </div>
        )}

        {strip && steps && stepIndex + 1 < steps.length && (
          <div className="space-y-2">
            <p className="type-overline m-0 uppercase opacity-90">{t('hero.after')}</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {steps.slice(stepIndex + 1, stepIndex + 4).map((step) => {
                const Icon = FORM_ICONS[formOf(step)];
                return (
                  <li
                    key={step.assignmentId}
                    className="type-body flex items-start gap-2 opacity-90"
                  >
                    <Icon aria-hidden className="mt-1 size-4 shrink-0" />
                    <span className="line-clamp-1 min-w-0">
                      {step.title} · {itemMeta(step, t)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
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
            {/* La ruta completa vive en la página del curso (7/10); junto a la acción (8/10). */}
            <Link
              href={`/aprender/curso/${row.enrollmentId}`}
              className="type-body min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
            >
              {t('course.seeRoute')}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </div>
        )}

        {/* Programa terminado: `KeepLearningHero` (8/10). */}
        {(gate?.kind === 'ACCESS_EXPIRED' || routeDone) && (
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
