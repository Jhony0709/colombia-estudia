/**
 * GET   /api/content/lessons/[lessonId] — abre el DRAFT sobre el que se edita.
 * PATCH /api/content/lessons/[lessonId] — lo guarda (es el autosave).
 * SSOT: reference/02-api/endpoints.md:55 — "Edita el DRAFT".
 *
 * El `GET` **crea** el DRAFT si la versión más alta está publicada: editar un tema
 * publicado abre la siguiente versión, nunca toca la que la gente está estudiando.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { openDraft, saveDraft } from '@/features/content/server/lessons.service';

export const GET = apiHandler({ capability: 'lesson.author' })(async (_req, ctx) =>
  openDraft({
    institutionId: requireInstitutionId(ctx.institutionId),
    lessonId: await routeParam(ctx.params, 'lessonId'),
  })
);

const schema = z.object({
  versionId: z.string().cuid(),
  content: z.string().max(200_000),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  invalidatesProgress: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'lesson.author' })(
  async (_req, ctx, input) =>
    saveDraft({
      institutionId: requireInstitutionId(ctx.institutionId),
      versionId: input.versionId,
      content: input.content,
      estimatedMinutes: input.estimatedMinutes,
      invalidatesProgress: input.invalidatesProgress,
    })
);
