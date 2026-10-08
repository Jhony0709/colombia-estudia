/**
 * El player de un tema.
 * SSOT: reference/01-routing/routes.md:28, plan/08-aprender-y-evaluar.md:22-33.
 *
 * Server Component: el contenido llega renderizado y saneado desde el servidor, y la página
 * es el `h1`, el contenido y la barra de acciones. La evidencia de progreso
 * (`evidence-recorder.tsx`) y el formulario de entrega (`submission-form.tsx`) entraron el
 * 19/9; el video con transcripción sincronizada (§2b) sigue pendiente.
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getLessonForStudent, type LessonNeighbour } from '@/features/learn/server/lesson.service';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Alert } from '@/components/atoms/alert';
import { Button } from '@/components/atoms/button';
import { StickyActionBar } from '@/components/organisms/sticky-action-bar';
import { ArrowDown, ArrowLeft, ArrowRight, CircleCheck, Target, Lock } from 'lucide-react';
import { Callout } from '@/components/atoms/callout';
import { requiredReadingSeconds } from '@colombia-estudia/domain';
import { EvidenceRecorder } from './evidence-recorder';
import { ReadingCountdown } from './reading-countdown';
import { EnterOnChange } from '@/components/atoms/motion';
import { SubmissionForm } from './submission-form';
import { TranscriptPanel } from './transcript-panel';
import { LessonTools } from './lesson-tools';
import { ReadingProgress } from './reading-progress';
import { LessonOutline } from './lesson-outline';
import { TaskBar, TaskMode } from '@/components/organisms/task-mode';
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { RouteRail, WithRouteRail } from '../../route-rail';
import { cn } from '@/lib/utils';

/**
 * `cache` de React memoiza por petición: `generateMetadata` y la página piden lo mismo, y
 * sin esto la ruta del programa y el render del tema se calcularían **dos veces** por cada
 * visita. No es la caché de datos de Next: no sobrevive a la petición, que es justo lo que
 * se quiere para algo que depende de quién pregunta.
 */
const load = cache(async (institutionId: string, personId: string, assignmentId: string) =>
  getLessonForStudent({ institutionId, personId, assignmentId })
);

// El título de la pestaña es el del tema: con veinte pestañas abiertas, "Tema" en todas no
// distingue nada.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}): Promise<Metadata> {
  const { assignmentId } = await params;
  const ctx = await getRequestContext();
  if (!ctx.person) return { title: 'Aprender' };

  const view = await load(ctx.institution.id, ctx.person.id, assignmentId);

  return { title: view.lesson ? view.lesson.title : 'Aprender' };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const view = await load(ctx.institution.id, ctx.person.id, assignmentId);

  if (view.gate) {
    // Un tema que no es de esta persona no existe para esta persona: 404, no "no tienes
    // permiso". Decirlo confirmaría qué ids son reales.
    if (view.gate.kind === 'NOT_ASSIGNED') notFound();

    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState
          title={
            view.gate.kind === 'COHORT'
              ? t(`gate.${view.gate.cohort.kind}.title`)
              : t(`lesson.gate.${view.gate.kind}.title`)
          }
          description={
            view.gate.kind === 'COHORT'
              ? t(`gate.${view.gate.cohort.kind}.body`, {
                  date:
                    'startsOn' in view.gate.cohort
                      ? view.gate.cohort.startsOn
                      : 'accessUntil' in view.gate.cohort
                        ? view.gate.cohort.accessUntil
                        : '',
                })
              : view.gate.kind === 'BLOCKED'
                ? t('blockedBy', { title: view.gate.blockedBy })
                : t(`lesson.gate.${view.gate.kind}.body`)
          }
          supportEmail={ctx.institution.supportEmail}
        />
        <p className="type-body">
          <Link
            href="/aprender"
            className="text-text-link min-h-touch inline-flex items-center underline"
          >
            {t('lesson.backToOutline')}
          </Link>
        </p>
      </Page>
    );
  }

  // Sin `gate` siempre hay tema: el servicio devuelve uno u otro, nunca ninguno de los dos.
  const { lesson, progress, submission, navigation } = view;
  if (!lesson) notFound();

  // «Módulo 2 · Paso 3 de 8 · 12 min» (23/9): dónde estoy en la ruta, sin abrir el rail.
  const place = placeInRoute(view.route, lesson.assignmentId);
  const meta = [
    place
      ? t('lesson.place', { module: place.module, index: place.index, total: place.total })
      : lesson.moduleName,
    lesson.estimatedMinutes !== null
      ? t('lesson.minutes', { count: lesson.estimatedMinutes })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const status = progress?.status ?? 'NOT_STARTED';
  // Sin minutos (0 o vacío) no hay espera, solo el scroll (5/10).
  const requiredSeconds =
    lesson.form === 'MARKDOWN' ? requiredReadingSeconds(lesson.estimatedMinutes) : 0;
  // Un tema que solo es actividad (4/10): quitado el título repetido, no queda texto.
  const hasText = lesson.html.trim() !== '';
  const evidence = (
    // Evidencia de estudio (§2b): el servidor decide `COMPLETED`; esto solo mide.
    <EvidenceRecorder
      assignmentId={lesson.assignmentId}
      form={lesson.form}
      initialStatus={progress?.status ?? 'NOT_STARTED'}
      requiredSeconds={requiredSeconds}
      scrolledBefore={progress?.scrolledToEnd ?? false}
    />
  );

  return (
    <Page wide>
      {/* Modo tarea (E2, 23/9): en el teléfono, la barra global se va y esta la sustituye. */}
      <TaskMode />
      {/* Avance de lectura (27/9): la línea fina del borde superior; solo si el texto no cabe. */}
      <ReadingProgress />
      <TaskBar
        backHref={`/aprender/curso/${lesson.enrollmentId}`}
        backLabel={t('task.back')}
        place={meta}
        action={<LessonTools assignmentId={lesson.assignmentId} compact />}
      />
      {/* La ruta al lado (21/9): dónde estoy y qué sigue, sin volver al panel. La cabecera va
          en la columna del contenido (27/9). */}
      <WithRouteRail
        rail={
          <RouteRail
            modules={view.route}
            currentId={lesson.assignmentId}
            enrollmentId={lesson.enrollmentId}
          />
        }
        header={
          // La cabecera ocupa la columna entera: «Opciones» queda sobre el borde del índice y
          // de la barra del pie; a la medida del texto, el overline se partía en dos líneas.
          <PageHeader
            overline={meta}
            // Bajo `lg` el lugar en la ruta ya va en la barra de tarea.
            overlineFromLg
            title={lesson.title}
            // Bajo `lg` la barra de tarea ya lleva las herramientas (compactas): dos «…»
            // en la misma pantalla era lo que se veía en el teléfono (auditoría 27/9).
            action={
              <div className="hidden lg:block">
                <LessonTools assignmentId={lesson.assignmentId} />
              </div>
            }
          />
        }
      >
        {/* Una sola medida (4/10): texto, actividad y entrega comparten el borde derecho. Desde
            `xl`, el índice del tema ocupa lo que sobra a la derecha. */}
        <div className="xl:grid xl:grid-cols-[minmax(0,var(--size-measure))_minmax(0,1fr)] xl:gap-12">
          <div className="max-w-measure min-w-0 space-y-10">
            {/* Un recurso que falta se dice. Un hueco silencioso deja al estudiante creyendo que
              la página cargó entera. */}
            {lesson.missingAssets.length > 0 && (
              <Alert severity="warning">
                {t('lesson.missingAssets', { count: lesson.missingAssets.length })}
              </Alert>
            )}

            {/* El objetivo (27/9) como recuadro y no como subtítulo gris: es lo primero que se lee
                y dice para qué sirve el tema. Mismo `Callout` que un `:::callout` del contenido. */}
            {lesson.learningObjective && (
              <Callout
                kind="important"
                title={t('lesson.objective')}
                icon={<Target aria-hidden className="size-4 shrink-0" />}
              >
                <p className="type-body text-text m-0">{lesson.learningObjective}</p>
              </Callout>
            )}

            {/*
              El texto, sus transcripciones y el medidor de evidencia van en un solo bloque: el
              medidor pinta un centinela de 1 px y un aviso solo para lectores de pantalla, y
              sueltos en el `space-y` dejaban 80 px vacíos antes de «Practica» (4/10).

              `dangerouslySetInnerHTML` con el nombre que tiene, y aquí está bien: este HTML sale
              de `renderLessonHtml`, que pasa por `rehype-sanitize` con un esquema cerrado. Es EL
              sitio donde ese saneado se paga. Si alguna vez entra aquí HTML de otra procedencia,
              esta línea deja de ser segura.
            */}
            {hasText && (
              <div>
                <article
                  className="contenido"
                  lang={lesson.language}
                  dangerouslySetInnerHTML={{ __html: lesson.html }}
                />
                {/* Transcripción sincronizada de cada video (§2): clic lleva al segundo. */}
                <TranscriptPanel transcripts={lesson.transcripts} />
                {evidence}
              </div>
            )}

            {/*
              «Practica» (23/9): la actividad es el paso siguiente al contenido y va como bloque
              propio, separado por una raya cuando hay texto encima (sin texto, la raya quedaba
              entre el título y la actividad). Sin instrucciones se dice, para que no parezca que
              faltan por un error.
            */}
            {lesson.activity !== null && (
              <section
                aria-labelledby="actividad-titulo"
                id="practica"
                className={cn('space-y-3', hasText && 'border-border-muted border-t pt-8')}
              >
                <p className="type-overline text-text-muted">{t('activity.step')}</p>
                <h2 id="actividad-titulo" className="type-heading">
                  {t('activity.title')}
                </h2>
                {lesson.activity.html ? (
                  // Mismo `renderLessonHtml` y mismo saneado que el texto del tema: es el único
                  // HTML de otra procedencia que entra aquí, y pasa por el mismo esquema cerrado.
                  <div
                    className="contenido"
                    lang={lesson.language}
                    dangerouslySetInnerHTML={{ __html: lesson.activity.html }}
                  />
                ) : (
                  <p className="type-body text-text-muted">{t('activity.none')}</p>
                )}
                <p className="type-caption text-text-muted">
                  {t(`activity.accepts.${lesson.activity.accepts}`)}
                  {lesson.activity.autoApprove ? ` ${t('activity.autoApprove')}` : ''}
                </p>
              </section>
            )}

            {/* La entrega (§2b): el formulario, o el estado de la que ya se mandó. Sin texto, el
                medidor va al final, con ella. */}
            {((lesson.requiresSubmission && lesson.activity !== null) || !hasText) && (
              <div>
                {lesson.requiresSubmission && lesson.activity !== null && (
                  <SubmissionForm
                    assignmentId={lesson.assignmentId}
                    submission={submission}
                    accepts={lesson.activity.accepts}
                    prompts={lesson.activity.prompts}
                    dateLabel={
                      submission
                        ? format.dateTime(
                            new Date(submission.reviewedAt ?? submission.submittedAt),
                            {
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit',
                              // Sin «p. m.»: la abreviatura termina en punto y la frase también, y
                              // salía «12:20 p. m..» (visto con Estudiante Uno, 23/9).
                              hour12: false,
                            }
                          )
                        : null
                    }
                  />
                )}
                {!hasText && evidence}
              </div>
            )}
          </div>

          {lesson.outline.length >= 3 && (
            <LessonOutline items={lesson.outline} label={t('lesson.outline')} />
          )}
        </div>

        <LessonNav
          previous={navigation.previous}
          next={navigation.next}
          assignmentId={lesson.assignmentId}
          enrollmentId={lesson.enrollmentId}
          currentTitle={lesson.title}
          status={status}
          form={lesson.form}
          submission={submission?.status ?? null}
          requiresSubmission={lesson.requiresSubmission}
          reading={{
            requiredSeconds,
            savedSeconds: progress?.secondsOnLesson ?? 0,
            savedScrolled: progress?.scrolledToEnd ?? false,
          }}
        />
      </WithRouteRail>
    </Page>
  );
}

/**
 * Dónde cae este tema en la ruta: su módulo y «paso x de y» contando temas y exámenes, como el
 * riel («5 de 8 completados»); hasta el 4/10 contaba solo los temas y los dos números no casaban.
 */
function placeInRoute(
  route: Array<{
    name: string;
    position: number;
    items: Array<{ kind: string; assignmentId: string }>;
  }>,
  assignmentId: string
): { module: string; index: number; total: number } | null {
  for (const block of route) {
    const index = block.items.findIndex((item) => item.assignmentId === assignmentId);
    if (index >= 0) {
      return {
        module: `${block.position}. ${block.name}`,
        index: index + 1,
        total: block.items.length,
      };
    }
  }
  return null;
}

/**
 * La barra fija del pie (23/9, `docs/ux/decision-ux-2309.md`): a la izquierda qué falta o
 * qué pasó; a la derecha **una** acción que cambia con el estado:
 *
 * - tema con actividad sin entregar → «Ir a la actividad» (baja a «Practica»; hasta el 27/9
 *   decía «Enviar actividad», igual que el botón real del formulario, y al pulsarlo con el
 *   formulario ya a la vista no pasaba nada visible: ni enviaba ni avisaba);
 * - actividad devuelta → «Enviar nueva versión»; en revisión → nada que pulsar, se dice;
 * - siguiente habilitado → «Siguiente: …» o «Ir al examen: …»;
 * - siguiente bloqueado → se dice qué falta, sin botón que no lleve a ninguna parte.
 *
 * Anterior y «Volver a la ruta» son salidas, en texto. Hasta el 23/9 esta barra solo tenía
 * anterior/siguiente y el estado de la evidencia flotaba en medio del scroll.
 */
async function LessonNav({
  previous,
  next,
  assignmentId,
  enrollmentId,
  currentTitle,
  status,
  form,
  submission,
  requiresSubmission,
  reading,
}: {
  previous: LessonNeighbour | null;
  next: LessonNeighbour | null;
  assignmentId: string;
  enrollmentId: string;
  currentTitle: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  form: 'VIDEO' | 'MARKDOWN' | 'SUBMISSION';
  submission: 'SUBMITTED' | 'RETURNED' | 'APPROVED' | null;
  requiresSubmission: boolean;
  reading: { requiredSeconds: number; savedSeconds: number; savedScrolled: boolean };
}) {
  const t = await getTranslations('learn');

  const pendingSubmission = requiresSubmission && submission !== 'APPROVED';
  const statusText =
    status === 'COMPLETED'
      ? t('evidence.status.COMPLETED')
      : pendingSubmission
        ? submission === 'SUBMITTED'
          ? t('bar.inReview')
          : submission === 'RETURNED'
            ? t('bar.returned')
            : t('bar.needsSubmission')
        : t(`evidence.status.${status}`, { form: t(`evidence.form.${form}`) });

  let action: React.ReactNode = null;
  // E0 (23/9): la acción principal de la barra se mide (mostrada / pulsada), incluida la
  // «bloqueada»: cuántas veces el estudiante llega al pie sin poder seguir es el dato.
  const track = (kind: 'submit' | 'next' | 'exam' | 'blocked', node: React.ReactNode) => (
    <PrimaryActionTracker
      screen="lesson"
      action={kind}
      assignmentId={assignmentId}
      form={form}
      enrollmentId={enrollmentId}
    >
      {node}
    </PrimaryActionTracker>
  );
  if (pendingSubmission && submission !== 'SUBMITTED') {
    action = track(
      'submit',
      <Button asChild>
        <a href="#practica">
          {submission === 'RETURNED' ? t('bar.resend') : t('bar.send')}
          <ArrowDown aria-hidden className="size-4 shrink-0" />
        </a>
      </Button>
    );
  } else if (
    next &&
    !next.enabled &&
    next.blockedBy === currentTitle &&
    form === 'MARKDOWN' &&
    status !== 'COMPLETED'
  ) {
    // Lo único que falta es leer este tema (5/10): el botón ya está, deshabilitado, con la
    // cuenta atrás o «Lee hasta el final»; antes era una frase y no se sabía cuánto faltaba.
    action = track('blocked', <ReadingCountdown {...reading} />);
  } else if (next) {
    // Habilitado: el botón; bloqueado: el texto que dice qué falta (sin enlace que no lleve
    // a ninguna parte).
    action = track(
      !next.enabled ? 'blocked' : next.kind === 'ASSESSMENT' ? 'exam' : 'next',
      <NavLink item={next} direction="next" currentTitle={currentTitle} />
    );
  }

  return (
    <StickyActionBar
      label={t('lesson.navLabel')}
      status={
        // Al completarse en la sesión, el estado y la acción entran (experiencia §6); al
        // cargar, nada se mueve.
        <EnterOnChange value={status} className="inline-flex items-center gap-2">
          {status === 'COMPLETED' && (
            <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
          )}
          {statusText}
        </EnterOnChange>
      }
      // «Volver a la ruta» se fue de aquí (auditoría 27/9): bajo `lg` lo lleva la barra de
      // tarea y desde `lg` el riel («Ver toda la ruta»); en el pie era el tercer enlace de una
      // barra que en el teléfono ocupaba tres filas.
      secondary={previous ? <NavLink item={previous} direction="previous" /> : null}
      action={
        action ? (
          <EnterOnChange value={status} className="inline-flex">
            {action}
          </EnterOnChange>
        ) : null
      }
    />
  );
}

async function NavLink({
  item,
  direction,
  currentTitle,
}: {
  item: LessonNeighbour;
  direction: 'previous' | 'next';
  /** Para decir «completa este tema» en vez de repetir su propio título. */
  currentTitle?: string;
}) {
  const t = await getTranslations('learn');

  const href =
    item.kind === 'LESSON'
      ? `/aprender/tema/${item.assignmentId}`
      : `/aprender/examen/${item.assignmentId}`;

  if (!item.enabled) {
    const reason =
      item.blockedBy === currentTitle
        ? t('lesson.completeToContinue', { title: item.title })
        : item.blockedBy
          ? t('blockedBy', { title: item.blockedBy })
          : item.locked
            ? t('lesson.nextLocked')
            : t('notYet');
    return (
      <span className="type-caption text-text-muted inline-flex items-center gap-1.5 text-left sm:max-w-[20rem] sm:text-right">
        {/* En el teléfono (4/10) la barra ya dice el estado arriba; aquí basta el candado y
            «Siguiente»: la frase entera eran dos líneas más bajo el pulgar. */}
        <Lock aria-hidden className="size-4 shrink-0 sm:hidden" />
        <span className="sm:hidden" aria-hidden="true">
          {t('lesson.nextShortLocked')}
        </span>
        <span className="sr-only sm:not-sr-only">{reason}</span>
      </span>
    );
  }

  if (direction === 'next') {
    return (
      <Button asChild>
        <Link href={href}>
          {/* En el teléfono cabe «Siguiente» y poco más; el título completo va en el nombre
              accesible. Desde `sm`, el título truncado a lo que quepa. */}
          <span className="sr-only sm:not-sr-only sm:max-w-[16rem] sm:truncate lg:max-w-[18rem] xl:max-w-[24rem]">
            {item.kind === 'ASSESSMENT'
              ? t('lesson.nextExam', { title: item.title })
              : t('lesson.next', { title: item.title })}
          </span>
          <span aria-hidden className="sm:hidden">
            {t('lesson.nextShort')}
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      </Button>
    );
  }

  return (
    <Link
      href={href}
      className="text-text-link type-caption min-h-touch inline-flex min-w-0 items-center gap-1 underline"
    >
      <ArrowLeft aria-hidden className="size-4 shrink-0" />
      <span className="sr-only sm:not-sr-only sm:max-w-[12rem] sm:truncate">
        {t('lesson.previous', { title: item.title })}
      </span>
      <span aria-hidden className="sm:hidden">
        {t('lesson.previousShort')}
      </span>
    </Link>
  );
}
