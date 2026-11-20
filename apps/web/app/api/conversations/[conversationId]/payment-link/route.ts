/**
 * POST /api/conversations/[conversationId]/payment-link — el link de Bold de la próxima cuota de
 * la persona enlazada (19/11). Body `{ delivery }`: `email` se lo envía Bold a su correo; `chat`
 * lo deja en WhatsApp. Solo quien tomó el chat. `billing.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { sendPaymentLink } from '@/features/messaging/server/conversations.service';

const schema = z.object({ delivery: z.enum(['email', 'chat']) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  req,
  ctx,
  input
) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return sendPaymentLink({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    conversationId: await routeParam(ctx.params, 'conversationId'),
    delivery: input.delivery,
    origin: req.nextUrl.origin,
  });
});
