/**
 * GET /api/conversations/[conversationId] — un chat de `/mensajes` para la app móvil (27/11).
 * `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { getConversation } from '@/features/messaging/server/conversations.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  const conversation = await getConversation({
    institutionId: requireInstitutionId(ctx.institutionId),
    conversationId: await routeParam(ctx.params, 'conversationId'),
  });
  if (!conversation) throw new APIError('Not found', 'NOT_FOUND');
  return conversation;
});
