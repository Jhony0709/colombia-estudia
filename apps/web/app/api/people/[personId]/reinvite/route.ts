/**
 * POST /api/people/[personId]/reinvite — volver a invitar.
 * SSOT: reference/02-api/endpoints.md:75 — "reinvitar invalida el anterior".
 *
 * La invalidación no se hace aquí: `sendInvitation` vence las invitaciones pendientes antes
 * de crear la nueva, así que el enlace viejo deja de servir en cuanto sale el nuevo correo.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { sendInvitation } from '@/features/auth/server/invitations.service';

export const POST = apiHandler({ capability: 'people.manage' })(async (req, ctx) => {
  const reqCtx = await getRequestContext();
  if (!reqCtx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return sendInvitation({
    institution: reqCtx.institution,
    personId: await routeParam(ctx.params, 'personId'),
    actorId: reqCtx.person.id,
    origin: req.nextUrl.origin,
    reinvite: true,
  });
});
