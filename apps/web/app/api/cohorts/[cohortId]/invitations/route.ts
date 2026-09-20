/**
 * GET  /api/cohorts/[cohortId]/invitations — a quién se le enviaría, y por qué al resto no.
 * POST /api/cohorts/[cohortId]/invitations — enviar, en lotes de 20.
 * SSOT: plan/06-cohortes-y-personas.md:57-63.
 * AMBIGUO: el contrato solo tiene la invitación individual (`endpoints.md:75`). Registrado
 * allí como añadido de §15.
 *
 * El `GET` existe para que la confirmación pueda decir un número real ("Enviar invitaciones
 * a 55 personas") en vez de una promesa.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import {
  planBulkInvitations,
  sendBulkInvitations,
} from '@/features/cohorts/server/bulk-invitations.service';

export const GET = apiHandler({ capability: 'people.manage' })(async (_req, ctx) =>
  planBulkInvitations({
    institutionId: requireInstitutionId(ctx.institutionId),
    cohortId: await routeParam(ctx.params, 'cohortId'),
  })
);

export const POST = apiHandler({ capability: 'people.manage' })(async (req, ctx) => {
  const reqCtx = await getRequestContext();
  if (!reqCtx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return sendBulkInvitations({
    institution: reqCtx.institution,
    cohortId: await routeParam(ctx.params, 'cohortId'),
    actorId: reqCtx.person.id,
    // El origen sale de la petición y nunca de una variable de entorno: el enlace tiene
    // que apuntar al mismo sitio desde el que se pulsó el botón.
    origin: req.nextUrl.origin,
  });
});
