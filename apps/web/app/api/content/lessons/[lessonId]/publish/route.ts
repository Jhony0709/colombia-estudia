/**
 * POST /api/content/lessons/[lessonId]/publish — publica el DRAFT.
 * SSOT: reference/02-api/endpoints.md:56 — "Valida (contrato + a11y) o rechaza con lista".
 *
 * Capacidad `lesson.publish`, distinta de `lesson.author`: escribir un tema y decidir que
 * sale a las cohortes no son la misma decisión.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { publishLesson } from '@/features/content/server/lessons.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.publish' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return publishLesson({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    versionId: input.versionId,
  });
});
