/**
 * POST /api/conversations/[conversationId]/person — «Crear persona» con los datos de inscripción
 * que dejó por WhatsApp (14/11). Crea la ficha (o enlaza la que ya tiene ese correo) y la
 * conversación queda enlazada. `people.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { createPersonFromIntake } from '@/features/messaging/server/conversations.service';

export const POST = apiHandler({ capability: 'people.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return createPersonFromIntake({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
  });
});
