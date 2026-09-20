/**
 * `progress.read.cohort` tiene dos alcances: la institución entera (operación, instructor)
 * o un `partnerId` (el contacto del aliado, solo sobre las cohortes que financia). Esto
 * comprueba el alcance contra la cohorte pedida: fuera de alcance 403, inexistente 404.
 * SSOT: acceso-y-cartera.md:16, capabilities.ts `scopeAllows`.
 */

import 'server-only';

import { scopeAllows } from '@colombia-estudia/domain';
import { getRequestContext, type RequestContext } from './request-context';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export async function requireCohortInScope(cohortId: string): Promise<RequestContext> {
  const ctx = await getRequestContext();
  const scopes = ctx.capabilities.get('progress.read.cohort') ?? [];
  const cohort = await createTenantClient(ctx.institution.id).cohort.findFirst({
    where: { id: cohortId },
    select: { id: true, partnerId: true },
  });
  if (!cohort) throw new APIError('Not found', 'NOT_FOUND');
  if (!scopeAllows(scopes, { cohortId: cohort.id, partnerId: cohort.partnerId ?? undefined })) {
    throw new APIError(
      'Resource out of scope for capability: progress.read.cohort',
      'INSUFFICIENT_CAPABILITY'
    );
  }
  return ctx;
}
