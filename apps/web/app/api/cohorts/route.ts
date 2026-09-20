/**
 * POST /api/cohorts — crear una cohorte (queda en PLANNED).
 * SSOT: plan/06-cohortes-y-personas.md:23-30.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §13.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { optionalText, blankToNull, requireInstitutionId } from '@/lib/http/admin-input';
import { createCohort, PROGRESSIONS } from '@/features/cohorts/server/cohorts.service';

/** `@db.Date`: la fecha viaja como YYYY-MM-DD y se guarda a medianoche UTC. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD');

const schema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio').max(40),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  programId: z.string().trim().min(1, 'Elige un programa'),
  partnerId: optionalText(40),
  progression: z.enum(PROGRESSIONS as unknown as [string, ...string[]]),
  startsOn: isoDate,
  endsOn: isoDate,
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'cohort.manage' })(
  async (_req, ctx, input) =>
    createCohort({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      data: {
        code: input.code.trim(),
        name: input.name.trim(),
        programId: input.programId,
        partnerId: blankToNull(input.partnerId),
        progression: input.progression as 'LINEAR' | 'FREE',
        startsOn: new Date(input.startsOn),
        endsOn: new Date(input.endsOn),
      },
    })
);
