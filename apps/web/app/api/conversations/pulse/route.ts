/**
 * GET /api/conversations/pulse?id= — la huella de la bandeja (o de un chat con `id`), para que
 * `/mensajes` solo se vuelva a pedir cuando hay algo nuevo (19/11). Con `id`, además, marca que
 * quien lo atiende lo tiene a la vista (27/11): no se le avisa de lo que ya ve. `cohort.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { conversationsPulse } from '@/features/messaging/server/conversations.service';
import { markAgentSeen } from '@/features/messaging/server/agent-alerts.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (req, ctx) => {
  const id = req.nextUrl.searchParams.get('id');
  if (id && ctx.personId) {
    await markAgentSeen({
      institutionId: requireInstitutionId(ctx.institutionId),
      conversationId: id,
      actorId: ctx.personId,
    });
  }
  return {
    stamp: await conversationsPulse({
      institutionId: requireInstitutionId(ctx.institutionId),
      ...(id ? { conversationId: id } : {}),
    }),
  };
});
