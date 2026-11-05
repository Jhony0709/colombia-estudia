/**
 * PUT /api/admin/institution/whatsapp — el número de WhatsApp de la institución y quienes
 * atienden la bandeja (5/11). Body `{ phoneNumberId, agentPhones }`; los teléfonos con
 * indicativo. `institution.manage`. SSOT: reference/02-api/endpoints.md (Admin).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { updateWhatsAppSettings } from '@/features/admin/server/whatsapp-settings.service';

const schema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{6,30}$/, 'El Phone number ID son solo cifras')
    .nullable(),
  agentPhones: z.array(z.string().trim().min(1)).max(20),
});

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    updateWhatsAppSettings({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      phoneNumberId: input.phoneNumberId,
      agentPhones: input.agentPhones,
    })
);
