/**
 * GET /api/conversations?view= — la bandeja de `/mensajes` para la app móvil (27/11).
 * `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId } from '@/lib/http/admin-input';
import {
  listConversations,
  type ConversationView,
} from '@/features/messaging/server/conversations.service';

const VIEWS: readonly ConversationView[] = ['waiting', 'mine', 'open', 'bot', 'closed'];

export const GET = apiHandler({ capability: 'cohort.manage' })(async (req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  const view = (req.nextUrl.searchParams.get('view') ?? 'waiting') as ConversationView;
  if (!VIEWS.includes(view)) throw new APIError('Vista desconocida', 'VALIDATION_ERROR');
  return {
    conversations: await listConversations({
      institutionId: requireInstitutionId(ctx.institutionId),
      personId: ctx.personId,
      view,
    }),
  };
});
