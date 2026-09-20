/**
 * POST /api/people/[personId]/consent — registrar un consentimiento dado fuera de la plataforma.
 * SSOT: reference/02-api/endpoints.md:75 — "`PAPER`/`EMAIL`; menor ⇒ `signedById` ∈ acudientes".
 *
 * La versión de la política la pone el servidor con la vigente de la institución: quien
 * registra el papel no elige contra qué versión se firmó.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam, optionalText } from '@/lib/http/admin-input';
import { recordConsent } from '@/features/people/server/guardianship.service';

const schema = z.object({
  channel: z.enum(['PAPER', 'EMAIL']),
  /** Documento o correo de quien firma; vacío significa la propia persona (solo si es mayor). */
  signedByHandle: optionalText(160),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'people.manage' })(
  async (_req, ctx, input) =>
    recordConsent({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      subjectId: await routeParam(ctx.params, 'personId'),
      channel: input.channel,
      signedByHandle: input.signedByHandle.trim() || null,
    })
);
