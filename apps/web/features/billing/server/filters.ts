/** Los filtros de `/cartera` y `GET /api/billing`, desde la query. Puro. */

import { ACCOUNT_STATUSES, type BillingFilters } from './billing.service';

export function parseBillingFilters(
  sp: URLSearchParams | Record<string, string | undefined>
): BillingFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp[k]) ?? '';
  const estado = get('estado');
  return {
    cohortId: get('cohorte') || null,
    partnerId: get('aliado') || null,
    status:
      estado === 'NO_PLAN'
        ? 'NO_PLAN'
        : (ACCOUNT_STATUSES as readonly string[]).includes(estado)
          ? (estado as BillingFilters['status'])
          : null,
    q: get('q').trim().slice(0, 80),
  };
}
