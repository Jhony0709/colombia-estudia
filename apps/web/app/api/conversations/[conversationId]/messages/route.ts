/**
 * POST /api/conversations/[conversationId]/messages — responder desde `/mensajes` (5/11). Body
 * `{ body }`. Solo quien tomó el chat, y en WhatsApp dentro de las 24 h desde su último mensaje.
 * `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { replyToConversation } from '@/features/messaging/server/conversations.service';

const schema = z.object({ body: z.string().trim().min(1, 'Escribe un mensaje').max(4_000) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  ctx,
  input
) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return replyToConversation({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
    body: input.body,
  });
});
