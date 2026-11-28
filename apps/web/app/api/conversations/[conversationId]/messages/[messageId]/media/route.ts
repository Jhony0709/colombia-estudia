/**
 * GET /api/conversations/[conversationId]/messages/[messageId]/media — el archivo que mandó la
 * persona por el chat (27/11): redirige a una URL firmada recién hecha, para que el reproductor
 * de la bandeja no se rompa al caducar. Con `?as=url`, la URL en JSON para el reproductor de la
 * app móvil (27/11). `cohort.manage`. SSOT: reference/02-api/endpoints.md.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { success } from '@/lib/http/responses';
import { chatMediaUrl } from '@/features/messaging/server/chat-media.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (req, ctx) => {
  const url = await chatMediaUrl({
    institutionId: requireInstitutionId(ctx.institutionId),
    conversationId: await routeParam(ctx.params, 'conversationId'),
    messageId: await routeParam(ctx.params, 'messageId'),
  });
  const res =
    req.nextUrl.searchParams.get('as') === 'url'
      ? success({ url })
      : NextResponse.redirect(url, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
