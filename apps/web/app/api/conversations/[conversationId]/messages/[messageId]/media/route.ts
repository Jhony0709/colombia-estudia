/**
 * GET /api/conversations/[conversationId]/messages/[messageId]/media — el archivo que mandó la
 * persona por el chat (27/11): redirige a una URL firmada recién hecha, para que el reproductor
 * de la bandeja no se rompa al caducar. `cohort.manage`. SSOT: reference/02-api/endpoints.md.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { chatMediaUrl } from '@/features/messaging/server/chat-media.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  const url = await chatMediaUrl({
    institutionId: requireInstitutionId(ctx.institutionId),
    conversationId: await routeParam(ctx.params, 'conversationId'),
    messageId: await routeParam(ctx.params, 'messageId'),
  });
  const res = NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
