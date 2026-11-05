/**
 * POST /api/conversations/[conversationId]/take — «Tomar chat» en `/mensajes` (5/11). El primero
 * gana; si ya la atiende otra persona, `CONFLICT` con su nombre. `cohort.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { takeConversation } from '@/features/messaging/server/conversations.service';

export const POST = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return takeConversation({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
  });
});
