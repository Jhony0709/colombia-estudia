/**
 * POST /api/billing/agreements/preview — la vista previa del calendario, sin escribir.
 * SSOT: endpoints.md:91 («vista previa → firma»). El plan hablaba de `POST …/[id]/confirm`,
 * pero `PaymentAgreement` no tiene estado borrador: la vista previa se calcula en memoria y
 * la firma es `POST /api/billing/agreements` (anotado en endpoints.md, 19/9).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { previewAgreement } from '@/features/billing/server/billing.service';

const agreementSchema = z.object({
  enrollmentId: z.string().cuid(),
  installments: z
    .array(
      z.object({ amount: z.number().int().positive().max(1_000_000_000), dueOn: z.string().date() })
    )
    .min(1)
    .max(36),
});
type Input = z.infer<typeof agreementSchema>;

export const POST = apiHandler<Input>({ schema: agreementSchema, capability: 'billing.manage' })(
  async (_req, _ctx, input) => {
    const ctx = await getRequestContext();
    return previewAgreement({
      institutionId: ctx.institution.id,
      enrollmentId: input.enrollmentId,
      installments: input.installments.map((i) => ({
        amount: i.amount,
        dueOn: new Date(`${i.dueOn}T00:00:00.000Z`),
      })),
    });
  }
);
