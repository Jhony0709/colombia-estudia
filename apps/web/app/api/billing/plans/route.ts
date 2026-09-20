/**
 * POST /api/billing/plans — plan + cuotas para una matrícula o para toda una cohorte de aliado.
 * SSOT: endpoints.md:89, plan/09 §2.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import {
  createPaymentPlans,
  activeEnrollmentIdsOfCohort,
  PERIODICITIES,
} from '@/features/billing/server/billing.service';

const schema = z
  .object({
    enrollmentId: z.string().cuid().optional(),
    cohortId: z.string().cuid().optional(),
    payerType: z.enum(['PERSON', 'PARTNER']),
    payerPersonId: z.string().cuid().nullable().optional(),
    partnerId: z.string().cuid().nullable().optional(),
    totalAmount: z.number().int().positive().max(1_000_000_000),
    installments: z.number().int().min(1).max(36),
    firstDueOn: z.string().date(),
    periodicity: z.enum(PERIODICITIES as unknown as [string, ...string[]]),
  })
  .refine((v) => Boolean(v.enrollmentId) !== Boolean(v.cohortId), {
    message: 'Indica una matrícula o una cohorte, no las dos',
  });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  let enrollmentIds: string[];
  if (input.enrollmentId) {
    enrollmentIds = [input.enrollmentId];
  } else {
    // Toda la cohorte: solo tiene sentido para un aliado que paga por todos.
    if (input.payerType !== 'PARTNER') {
      throw new APIError('Un plan para toda la cohorte es de un aliado', 'VALIDATION_ERROR');
    }
    enrollmentIds = await activeEnrollmentIdsOfCohort({
      institutionId: ctx.institution.id,
      cohortId: input.cohortId!,
    });
    if (enrollmentIds.length === 0)
      throw new APIError('La cohorte no tiene matrículas activas', 'CONFLICT');
  }

  return createPaymentPlans({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentIds,
    input: {
      payerType: input.payerType,
      payerPersonId: input.payerPersonId ?? null,
      partnerId: input.partnerId ?? null,
      totalAmount: input.totalAmount,
      installments: input.installments,
      firstDueOn: new Date(`${input.firstDueOn}T00:00:00.000Z`),
      periodicity: input.periodicity as 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY',
    },
  });
});
