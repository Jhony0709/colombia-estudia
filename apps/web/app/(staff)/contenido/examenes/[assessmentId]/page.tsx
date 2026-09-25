/**
 * Editor de una evaluación.
 * SSOT: reference/01-routing/routes.md:43, plan/07-contenido-y-migracion.md:40-44.
 *
 * La página **no carga la clave de respuestas**. El panel de la clave la pide por su propia
 * ruta cuando se abre: así el HTML de esta pantalla, que es lo que se cachea, se comparte en
 * una captura y acaba en el historial del navegador, nunca contiene el examen resuelto.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  openAssessmentDraft,
  resolveAssessment,
} from '@/features/content/server/assessments.service';
import { notFound, redirect } from 'next/navigation';
import { getAssessmentReadiness } from '@/features/content/server/readiness.service';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { listLessons } from '@/features/content/server/lessons.service';
import { Page } from '@/components/templates/page';
import { AssessmentEditor } from './assessment-editor';

export const metadata: Metadata = { title: 'Editar examen' };

type Params = Promise<{ assessmentId: string }>;

export default async function AssessmentEditorPage({ params }: { params: Params }) {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();
  const { assessmentId: ref } = await params;

  // La URL lleva el código (`EXA-0001`, 25/9); un enlace viejo con el `cuid` redirige.
  const resolved = await resolveAssessment({ institutionId: ctx.institution.id, ref });
  if (!resolved) notFound();
  if (ref !== resolved.code) redirect(`/contenido/examenes/${resolved.code}`);
  const assessmentId = resolved.id;

  const [draft, readiness, curriculum, allLessons, t] = await Promise.all([
    openAssessmentDraft({ institutionId: ctx.institution.id, assessmentId }),
    getAssessmentReadiness({ institutionId: ctx.institution.id, assessmentId }),
    listCurriculum(ctx.institution.id),
    listLessons({ institutionId: ctx.institution.id }),
    getTranslations('assessmentEditor'),
  ]);

  const canPublish = (ctx.capabilities.get('lesson.publish')?.length ?? 0) > 0;

  // Para «Datos del examen» (25/9): solo los componentes de SU programa —un examen no cambia
  // de programa— y los temas de esos componentes, para elegir de cuál es examen.
  const program = curriculum.programs.find((p) => p.id === draft.programId);
  const modules = (program?.modules ?? []).map((module) => ({ id: module.id, name: module.name }));
  const moduleIds = new Set(modules.map((module) => module.id));
  const lessons = allLessons
    .filter((lesson) => moduleIds.has(lesson.moduleId))
    .map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      moduleId: lesson.moduleId,
      position: lesson.position,
    }));
  const subjects = curriculum.subjects.map((subject) => ({ id: subject.id, name: subject.name }));

  return (
    <Page wide>
      <AssessmentEditor
        assessmentId={draft.assessmentId}
        versionId={draft.versionId}
        initialContent={JSON.stringify(draft.content, null, 2)}
        initialMaxAttempts={draft.maxAttempts}
        initialTimeLimitMinutes={draft.timeLimitMinutes}
        initialPassPercent={draft.passPercent}
        initialReviewPolicy={draft.reviewPolicy}
        canPublish={canPublish}
        readiness={readiness}
        header={{
          code: draft.code,
          title: draft.title,
          kindLabel: t(`kind.${draft.kind}`),
          number: draft.number,
          hasPublished: draft.hasPublished,
        }}
        details={{
          modules,
          lessons,
          subjects,
          initial: {
            title: draft.title,
            kind: draft.kind,
            moduleId: draft.moduleId,
            lessonId: draft.lessonId,
            subjectId: draft.subjectId,
            learningObjective: draft.learningObjective,
          },
        }}
      />
    </Page>
  );
}
