import 'server-only';

/**
 * Lo último que pasó con una familia de entidades, desde AuditLog, con el nombre de quien
 * lo hizo. Alimenta el carril «Actividad reciente» del panel (19/9); cada pantalla elige sus
 * entidades y qué acciones no cuenta (p. ej. `pii_read`, que taparía todo lo demás).
 */

import { createTenantClient } from '@/lib/db/tenant';

export interface RecentActivity {
  id: string;
  entity: string;
  action: string;
  occurredAt: Date;
  actorName: string | null;
}

export async function listRecentActivity({
  institutionId,
  entities,
  excludeActions = [],
  take = 6,
}: {
  institutionId: string;
  entities: readonly string[];
  excludeActions?: readonly string[];
  take?: number;
}): Promise<RecentActivity[]> {
  const db = createTenantClient(institutionId);
  const logs = await db.auditLog.findMany({
    where: {
      entity: { in: [...entities] },
      ...(excludeActions.length ? { action: { notIn: [...excludeActions] } } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    take,
    select: { id: true, entity: true, action: true, occurredAt: true, actorId: true },
  });
  const actorIds = [
    ...new Set(logs.map((l) => l.actorId).filter((id): id is string => Boolean(id))),
  ];
  const actors = actorIds.length
    ? await db.person.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const byId = new Map(actors.map((a) => [a.id, `${a.givenName} ${a.familyName}`]));
  return logs.map((l) => ({
    id: String(l.id),
    entity: l.entity,
    action: l.action,
    occurredAt: l.occurredAt,
    actorName: l.actorId ? (byId.get(l.actorId) ?? null) : null,
  }));
}
