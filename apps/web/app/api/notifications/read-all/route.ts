/**
 * PATCH /api/notifications/read-all — marcar leídas todas las propias.
 * SSOT: plan/11-ux.md:77-80 ("lista, marcar leída").
 * AMBIGUO: el contrato solo nombra la individual. Con cincuenta avisos, marcarlos de uno
 * en uno es una pantalla de cincuenta clics. Registrado en endpoints.md.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { markAllRead } from '@/features/notifications/server/notifications.service';

export const PATCH = apiHandler()(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return markAllRead({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
});
