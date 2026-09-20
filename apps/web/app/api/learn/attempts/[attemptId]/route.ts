/**
 * PATCH /api/learn/attempts/[attemptId] — autosave de respuestas. Idempotente.
 * SSOT: reference/02-api/endpoints.md:43, plan/08-aprender-y-evaluar.md:53.
 *
 * `null` o cadena vacía borran la respuesta. El plazo lo mira el servicio: un intento
 * vencido contesta `ATTEMPT_EXPIRED` (410) y el cliente deja de guardar.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { saveAnswers } from '@/features/learn/server/attempt.service';

const answer = z.union([z.string().max(4_000), z.array(z.string().max(64)).max(50), z.null()]);

const schema = z.object({
  answers: z.record(z.string().min(1).max(64), answer),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'assessment.take' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return saveAnswers({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    attemptId: await routeParam(routeCtx.params, 'attemptId'),
    answers: input.answers,
  });
});
