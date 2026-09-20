/**
 * GET   /api/content/assessments/[assessmentId] — abre el borrador. **Sin clave de respuestas.**
 * PATCH /api/content/assessments/[assessmentId] — guarda preguntas y ajustes del intento.
 * AMBIGUO: el contrato solo nombra `publish`. Registrado en endpoints.md.
 *
 * Ni el `GET` ni el `PATCH` tocan `answerKey`: vive en su propia ruta para que ninguna
 * respuesta del servidor lleve el examen y su solucionario juntos.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  openAssessmentDraft,
  saveAssessmentContent,
} from '@/features/content/server/assessments.service';

export const GET = apiHandler({ capability: 'lesson.author' })(async (_req, ctx) =>
  openAssessmentDraft({
    institutionId: requireInstitutionId(ctx.institutionId),
    assessmentId: await routeParam(ctx.params, 'assessmentId'),
  })
);

const schema = z.object({
  versionId: z.string().cuid(),
  content: z.unknown(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  timeLimitMinutes: z.number().int().min(1).max(600).nullable().optional(),
  passPercent: z.number().int().min(0).max(100).nullable().optional(),
  reviewPolicy: z.enum(['NONE', 'SCORE_ONLY', 'FULL_AFTER_GRADED', 'FULL_AFTER_DUE']).optional(),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'lesson.author' })(
  async (_req, ctx, input) =>
    saveAssessmentContent({
      institutionId: requireInstitutionId(ctx.institutionId),
      versionId: input.versionId,
      content: input.content,
      maxAttempts: input.maxAttempts,
      timeLimitMinutes: input.timeLimitMinutes,
      passPercent: input.passPercent,
      reviewPolicy: input.reviewPolicy,
    })
);
