/**
 * GET/PUT /api/inclusion/[enrollmentId]/accommodations — los ajustes razonables de una
 * matrícula. SSOT: reference/02-api/endpoints.md:94, ajustes-razonables.md.
 *
 * `PUT` entero, no `PATCH`: el formulario manda todos los campos siempre, y así el
 * servidor no tiene que adivinar qué significa una casilla ausente.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import {
  getAccommodation,
  upsertAccommodation,
} from '@/features/inclusion/server/accommodations.service';

const schema = z.object({
  extraTimeFactor: z.number().min(1).max(3),
  exemptFromTimer: z.boolean(),
  allowedAttemptsBonus: z.number().int().min(0).max(10),
  requiresCaptions: z.boolean(),
  allowsAssistiveTech: z.boolean(),
  notes: optionalText(2_000).optional(),
});

type Input = z.infer<typeof schema>;

export const GET = apiHandler({ capability: 'accommodation.manage' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  return getAccommodation({
    institutionId: ctx.institution.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
  });
});

export const PUT = apiHandler<Input>({ schema, capability: 'accommodation.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return upsertAccommodation({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    input: {
      extraTimeFactor: input.extraTimeFactor,
      exemptFromTimer: input.exemptFromTimer,
      allowedAttemptsBonus: input.allowedAttemptsBonus,
      requiresCaptions: input.requiresCaptions,
      allowsAssistiveTech: input.allowsAssistiveTech,
      notes: input.notes ? blankToNull(input.notes) : null,
    },
  });
});
