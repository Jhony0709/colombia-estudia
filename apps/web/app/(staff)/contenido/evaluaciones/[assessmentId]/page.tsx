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
import { openAssessmentDraft } from '@/features/content/server/assessments.service';
import { Page } from '@/components/templates/page';
import { AssessmentEditor } from './assessment-editor';

export const metadata: Metadata = { title: 'Editar evaluación' };

type Params = Promise<{ assessmentId: string }>;

export default async function AssessmentEditorPage({ params }: { params: Params }) {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();
  const { assessmentId } = await params;

  const [draft, t] = await Promise.all([
    openAssessmentDraft({ institutionId: ctx.institution.id, assessmentId }),
    getTranslations('assessmentEditor'),
  ]);

  const canPublish = (ctx.capabilities.get('lesson.publish')?.length ?? 0) > 0;

  return (
    <Page>
      <AssessmentEditor
        assessmentId={draft.assessmentId}
        versionId={draft.versionId}
        initialContent={JSON.stringify(draft.content, null, 2)}
        initialMaxAttempts={draft.maxAttempts}
        initialTimeLimitMinutes={draft.timeLimitMinutes}
        initialPassPercent={draft.passPercent}
        initialReviewPolicy={draft.reviewPolicy}
        canPublish={canPublish}
        header={{
          title: draft.title,
          kindLabel: t(`kind.${draft.kind}`),
          number: draft.number,
          hasPublished: draft.hasPublished,
        }}
      />
    </Page>
  );
}
