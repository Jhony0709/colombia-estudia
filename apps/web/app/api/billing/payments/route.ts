/** POST /api/billing/payments — paso 1: registra un pago manual y devuelve el resumen. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { optionalText, blankToNull } from '@/lib/http/admin-input';
import { registerPayment } from '@/features/billing/server/billing.service';

const schema = z.object({
  installmentId: z.string().cuid(),
  amount: z.number().int().positive().max(1_000_000_000),
  method: z.enum(['TRANSFER', 'BRE_B', 'CASH']),
  reference: optionalText(120).optional(),
  paidAt: z.string().date(),
});
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  return registerPayment({
    institutionId: ctx.institution.id,
    installmentId: input.installmentId,
    amount: input.amount,
    method: input.method,
    reference: input.reference ? blankToNull(input.reference) : null,
    paidAt: new Date(`${input.paidAt}T12:00:00.000Z`),
  });
});
