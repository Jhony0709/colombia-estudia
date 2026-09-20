/**
 * GET /api/notifications — los avisos de quien pregunta.
 * SSOT: reference/02-api/endpoints.md:34, plan/06-cohortes-y-personas.md:65-70.
 *
 * Sin capacidad: el contrato dice "cualquiera", porque cada quien ve **los suyos**. Lo que
 * filtra no es un permiso, es el `personId` del contexto de la petición — nunca uno que
 * venga en el cuerpo o en la URL.
 *
 * `apiHandler` solo rellena `ctx.personId` cuando se le pide una capacidad
 * (`lib/http/api-handler.ts`), así que aquí se resuelve el contexto a mano, igual que en
 * `app/api/people/invitations/route.ts`.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { listNotifications } from '@/features/notifications/server/notifications.service';

export const GET = apiHandler()(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return listNotifications({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
});
