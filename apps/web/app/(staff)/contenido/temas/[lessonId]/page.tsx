/**
 * Editor de un tema.
 * SSOT: reference/01-routing/routes.md:42, plan/07-contenido-y-migracion.md:28-38.
 *
 * Abrir esta pantalla **abre un DRAFT**: si la versión más alta está publicada, se crea la
 * siguiente copiando su contenido. Nunca se edita lo que las cohortes están estudiando.
 */

import type { Metadata } from 'next';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { openDraft } from '@/features/content/server/lessons.service';
import { getLessonReadiness } from '@/features/content/server/readiness.service';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { Page } from '@/components/templates/page';
import { LessonEditor } from './lesson-editor';

export const metadata: Metadata = { title: 'Editar tema' };

type Params = Promise<{ lessonId: string }>;

export default async function LessonEditorPage({ params }: { params: Params }) {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();
  const { lessonId } = await params;

  const [draft, curriculum, readiness] = await Promise.all([
    openDraft({ institutionId: ctx.institution.id, lessonId }),
    listCurriculum(ctx.institution.id),
    getLessonReadiness({ institutionId: ctx.institution.id, lessonId }),
  ]);

  // El módulo se elige con el nombre del programa delante: con varios programas, «Módulo 1»
  // a secas no identifica nada.
  const modules = curriculum.programs.flatMap((program) =>
    program.modules.map((module) => ({
      id: module.id,
      name: module.name,
      programName: program.name,
    }))
  );
  const subjects = curriculum.subjects.map((subject) => ({ id: subject.id, name: subject.name }));

  // Publicar es otra decisión que escribir: se puede tener una capacidad y no la otra.
  const canPublish = (ctx.capabilities.get('lesson.publish')?.length ?? 0) > 0;

  return (
    <Page wide>
      {/*
        La cabecera la pinta `LessonEditor`, no esta página: sus dos acciones —vista previa y
        publicar— dependen de lo escrito y sin guardar, que vive en el cliente. El `h1` sigue
        siendo el de `PageHeader`.
      */}
      <LessonEditor
        lessonId={draft.lessonId}
        versionId={draft.versionId}
        header={{
          title: draft.title,
          subjectName: draft.subjectName,
          number: draft.number,
          hasPublished: draft.hasPublished,
        }}
        initialContent={draft.content}
        initialEstimatedMinutes={draft.estimatedMinutes}
        initialInvalidatesProgress={draft.invalidatesProgress}
        canPublish={canPublish}
        readiness={readiness}
        activity={
          draft.requiresSubmission
            ? { instructions: draft.activityInstructions, accepts: draft.activityAccepts }
            : null
        }
        details={{
          modules,
          subjects,
          initial: {
            title: draft.title,
            learningObjective: draft.learningObjective,
            moduleId: draft.moduleId,
            subjectId: draft.subjectId,
            requiresSubmission: draft.requiresSubmission,
          },
        }}
      />
    </Page>
  );
}
