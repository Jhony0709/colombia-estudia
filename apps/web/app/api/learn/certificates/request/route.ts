/**
 * POST /api/learn/certificates/request — pedir el certificado de estudios (23/11).
 * Avisa a operación; no emite nada. SSOT: features/certificates/server/study-certificate.service.ts.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { requestStudyCertificate } from '@/features/certificates/server/study-certificate.service';

const schema = z.object({
  documentPlace: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(3).max(500),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'score.read.own' })(async (
  _req,
  _routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return requestStudyCertificate({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    documentPlace: input.documentPlace,
    reason: input.reason,
  });
});
