/**
 * GET /api/people/[personId] — detalle con PII.
 * SSOT: reference/02-api/endpoints.md:76 — "Detalle con PII → AuditLog person.pii_read".
 *
 * El registro de auditoría lo escribe el servicio, así que la página y este endpoint dejan
 * el mismo rastro: no hay forma de leer la PII sin que quede constancia.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { getPersonDetail } from '@/features/people/server/people.service';

export const GET = apiHandler({ capability: 'people.manage' })(async (_req, ctx) => {
  const personId = await routeParam(ctx.params, 'personId');

  const person = await getPersonDetail({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId ?? null,
    personId,
  });

  if (!person) {
    throw new APIError('Person not found', 'NOT_FOUND');
  }

  return person;
});
