/** POST /api/learn/account/pay { installmentId } — crea el checkout de Wompi y devuelve la URL. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { startCheckout } from '@/features/billing/server/account.service';

const schema = z.object({ installmentId: z.string().cuid() });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.read.own' })(async (
  req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return startCheckout({
    institutionId: ctx.institution.id,
    installmentId: input.installmentId,
    scopes: ctx.capabilities.get('billing.read.own') ?? [],
    origin: req.nextUrl.origin,
    customerEmail: ctx.person.email ?? null,
  });
});
