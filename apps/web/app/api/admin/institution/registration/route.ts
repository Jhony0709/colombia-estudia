/**
 * PUT /api/admin/institution/registration — la cohorte en la que entra quien se registra.
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1, reference/02-api/endpoints.md (Admin).
 *
 * Aparte de `PUT /api/admin/institution` porque no es un dato de la institución (marca,
 * contacto, política) sino un ajuste de operación que cambia cada vez que se abre una
 * cohorte de introducción nueva.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { updateRegistrationSettings } from '@/features/admin/server/registration.service';

const schema = z.object({ introCohortId: z.string().cuid().nullable() });

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    updateRegistrationSettings({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      introCohortId: input.introCohortId,
    })
);
