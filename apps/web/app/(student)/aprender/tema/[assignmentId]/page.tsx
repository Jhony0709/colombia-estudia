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
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getLessonForStudent, type LessonNeighbour } from '@/features/learn/server/lesson.service';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Alert } from '@/components/atoms/alert';
import { EvidenceRecorder } from './evidence-recorder';
import { SubmissionForm } from './submission-form';
import { TranscriptPanel } from './transcript-panel';
import { ReadingPreferences } from './reading-preferences';
import { ReportProblem } from './report-problem';

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

  const meta = [
    lesson.moduleName,
    lesson.estimatedMinutes !== null
      ? t('lesson.minutes', { count: lesson.estimatedMinutes })
      : null,
    t(`status.${progress?.status ?? 'NOT_STARTED'}`),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Page>
      <PageHeader
        overline={meta}
        title={lesson.title}
        description={lesson.learningObjective ?? undefined}
      />

      {lesson.requiresSubmission && (
        <Alert severity="info">{t('lesson.needsSubmissionNotice')}</Alert>
      )}

      {/* Preferencias de lectura (§2): tamaño, espaciado y ancho, guardadas en el navegador. */}
      <ReadingPreferences />

      {/* Un recurso que falta se dice. Un hueco silencioso deja al estudiante creyendo que
          la página cargó entera. */}
      {lesson.missingAssets.length > 0 && (
        <Alert severity="warning">
          {t('lesson.missingAssets', { count: lesson.missingAssets.length })}
        </Alert>
      )}

      {/*
        `dangerouslySetInnerHTML` con el nombre que tiene, y aquí está bien: este HTML sale de
        `renderLessonHtml`, que pasa por `rehype-sanitize` con un esquema cerrado. Es EL sitio
        donde ese saneado se paga. Si alguna vez entra aquí HTML de otra procedencia, esta
        línea deja de ser segura.
      */}
      <article
        className="contenido max-w-reading"
        lang={lesson.language}
        dangerouslySetInnerHTML={{ __html: lesson.html }}
      />

      {/* Transcripción sincronizada de cada video (§2): clic lleva al segundo; «solo transcripción». */}
      <TranscriptPanel transcripts={lesson.transcripts} />

      {/* Evidencia de estudio (§2b): el servidor decide `COMPLETED`; esto solo mide. */}
      <EvidenceRecorder
        assignmentId={lesson.assignmentId}
        form={lesson.form}
        initialStatus={progress?.status ?? 'NOT_STARTED'}
      />

      {/* La entrega (§2b): el formulario, o el estado de la que ya se mandó. */}
      {lesson.requiresSubmission && (
        <SubmissionForm assignmentId={lesson.assignmentId} submission={submission} />
      )}

      <LessonNav previous={navigation.previous} next={navigation.next} />

      {/* «Reportar un problema» (§2): al final, discreto; avisa a operación e instructores. */}
      <ReportProblem assignmentId={lesson.assignmentId} />
    </Page>
  );
}

/**
 * Anterior · La ruta · Siguiente.
 *
 * Lo bloqueado **no es un enlace**: con progresión lineal el siguiente está bloqueado hasta
 * que este tema se complete, y un enlace que no lleva a ninguna parte se anuncia como enlace
 * y frustra a quien lo pulsa. En su lugar va el texto que dice qué falta.
 */
async function LessonNav({
  previous,
  next,
}: {
  previous: LessonNeighbour | null;
  next: LessonNeighbour | null;
}) {
  const t = await getTranslations('learn');

  return (
    <nav aria-label={t('lesson.navLabel')} className="border-border mt-8 border-t pt-4">
      <ul className="flex flex-wrap items-center justify-between gap-3">
        <li>{previous ? <NavLink item={previous} direction="previous" /> : null}</li>
        <li>
          <Link
            href="/aprender"
            className="text-text-link min-h-touch inline-flex items-center underline"
          >
            {t('lesson.backToOutline')}
          </Link>
        </li>
        <li>{next ? <NavLink item={next} direction="next" /> : null}</li>
      </ul>
    </nav>
  );
}

async function NavLink({
  item,
  direction,
}: {
  item: LessonNeighbour;
  direction: 'previous' | 'next';
}) {
  const t = await getTranslations('learn');

  const href =
    item.kind === 'LESSON'
      ? `/aprender/tema/${item.assignmentId}`
      : `/aprender/evaluacion/${item.assignmentId}`;

  if (!item.enabled) {
    return (
      <span className="type-caption text-text-muted block max-w-[20rem]">
        {item.blockedBy ? t('blockedBy', { title: item.blockedBy }) : t('notYet')}
      </span>
    );
  }

  return (
    <Link href={href} className="text-text-link min-h-touch inline-flex items-center underline">
      {t(direction === 'previous' ? 'lesson.previous' : 'lesson.next', { title: item.title })}
    </Link>
  );
}
