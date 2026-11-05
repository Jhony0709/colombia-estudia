/**
 * POST /api/conversations/[conversationId]/close — cerrar un chat de `/mensajes` (5/11). Solo
 * quien lo tomó; la próxima vez que escriba, lo atiende el bot. `cohort.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { closeConversation } from '@/features/messaging/server/conversations.service';

export const POST = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return closeConversation({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
  });
});
