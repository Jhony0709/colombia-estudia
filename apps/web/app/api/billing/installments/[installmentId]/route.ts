/** PATCH /api/billing/installments/[installmentId] — monto y fecha de una cuota sin pagos. Audita. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateInstallment } from '@/features/billing/server/billing.service';

const schema = z.object({
  amount: z.number().int().positive().max(1_000_000_000).optional(),
  dueOn: z.string().date().optional(),
});
type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return updateInstallment({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    installmentId: await routeParam(routeCtx.params, 'installmentId'),
    amount: input.amount,
    dueOn: input.dueOn ? new Date(`${input.dueOn}T00:00:00.000Z`) : undefined,
  });
});
