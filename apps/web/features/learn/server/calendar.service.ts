/**
 * El calendario del estudiante: todas sus cohortes activas, mezcladas por fecha (21/9).
 *
 * Antes se miraba solo la matrícula más reciente y las fechas de las otras cohortes no
 * existían para el estudiante. Cada ítem de cohorte ya lleva el código de la cohorte en el
 * título, así que al mezclarlos se sabe de cuál es cada uno.
 */

import 'server-only';

import {
  getCalendarForEnrollment,
  type CalendarItem,
} from '@/features/cohorts/server/live-sessions.service';
import { listMyEnrollments } from './cohort.service';

export async function getCalendarForStudent({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<CalendarItem[]> {
  const mine = await listMyEnrollments({ institutionId, personId, now });
  const active = mine.filter((row) => row.gate === null);

  const lists = await Promise.all(
    active.map((row) =>
      getCalendarForEnrollment({ institutionId, enrollmentId: row.enrollmentId, now })
    )
  );

  return lists.flat().sort((a, b) => a.at.localeCompare(b.at));
}
