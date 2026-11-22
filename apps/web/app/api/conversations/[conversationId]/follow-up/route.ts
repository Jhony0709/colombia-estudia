/**
 * POST /api/conversations/[conversationId]/follow-up — retomar un chat fuera de las 24 h con la
 * plantilla de `WHATSAPP_TEMPLATE_FOLLOW_UP` (22/11). Solo quien tomó el chat; una por día.
 * `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { sendFollowUp } from '@/features/messaging/server/conversations.service';

export const POST = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return sendFollowUp({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
  });
});
