/**
 * Las cifras de las pestañas de una cohorte (4/10), para las páginas que las pintan sin cargar
 * la ficha entera: Actividades y Avance. Tres conteos, sin traer filas.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';

export interface CohortNavCounts {
  personas: number;
  actividades: number;
  sesiones: number;
}

export async function getCohortNavCounts({
  institutionId,
  cohortId,
  now = new Date(),
}: {
  institutionId: string;
  cohortId: string;
  now?: Date;
}): Promise<CohortNavCounts> {
  const db = createTenantClient(institutionId);
  const [personas, actividades, sesiones] = await Promise.all([
    db.enrollment.count({ where: { cohortId } }),
    db.submission.count({ where: { status: 'SUBMITTED', assignment: { cohortId } } }),
    db.liveSession.count({ where: { cohortId, archivedAt: null, endsAt: { gte: now } } }),
  ]);
  return { personas, actividades, sesiones };
}
