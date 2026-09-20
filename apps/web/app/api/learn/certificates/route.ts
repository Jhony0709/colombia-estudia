/**
 * GET /api/learn/certificates — las constancias del estudiante.
 * SSOT: endpoints.md:48 («funciona con acceso vencido y con cartera vencida»).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { listCertificatesForStudent } from '@/features/certificates/server/certificates.service';

export const GET = apiHandler({ capability: 'score.read.own' })(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return listCertificatesForStudent({ institutionId: ctx.institution.id, personId: ctx.person.id });
});
