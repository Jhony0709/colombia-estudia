/**
 * PATCH /api/notifications/[notificationId]/read — marcar leída.
 * SSOT: reference/02-api/endpoints.md:34.
 *
 * El `personId` de la sesión entra en el `where` del `UPDATE`, así que no hay manera de
 * marcar leída la notificación de otra persona pasando su id.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { markRead } from '@/features/notifications/server/notifications.service';

export const PATCH = apiHandler()(async (_req, handlerCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return markRead({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    notificationId: await routeParam(handlerCtx.params, 'notificationId'),
  });
});
