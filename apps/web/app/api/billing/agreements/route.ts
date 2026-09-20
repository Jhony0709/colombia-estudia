/** POST /api/billing/agreements — firma: anula pendientes, crea las nuevas, `ACTIVE`, audita. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { signAgreement } from '@/features/billing/server/billing.service';

const schema = z.object({
  enrollmentId: z.string().cuid(),
  installments: z
    .array(
      z.object({ amount: z.number().int().positive().max(1_000_000_000), dueOn: z.string().date() })
    )
    .min(1)
    .max(36),
  signerPersonId: z.string().cuid().nullable().optional(),
  partnerId: z.string().cuid().nullable().optional(),
  notes: optionalText(2_000).optional(),
});
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return signAgreement({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentId: input.enrollmentId,
    installments: input.installments.map((i) => ({
      amount: i.amount,
      dueOn: new Date(`${i.dueOn}T00:00:00.000Z`),
    })),
    signerPersonId: input.signerPersonId ?? null,
    partnerId: input.partnerId ?? null,
    notes: input.notes ? blankToNull(input.notes) : null,
  });
});
