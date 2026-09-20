/**
 * POST /api/content/assessments/[assessmentId]/validate — el panel de avisos del editor.
 * AMBIGUO: ruta añadida en §4, por la misma razón que la de los temas: una sola validación.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { validateAssessmentDraft } from '@/features/content/server/assessments.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.author' })(
  async (_req, ctx, input) =>
    validateAssessmentDraft({
      institutionId: requireInstitutionId(ctx.institutionId),
      versionId: input.versionId,
    })
);
