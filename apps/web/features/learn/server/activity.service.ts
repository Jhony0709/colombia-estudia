/**
 * El ritmo del estudiante (4/10, panel de `/aprender`): cuántos pasos dio cada día de las
 * últimas dos semanas y cuántos días estudió. Sale de `LearningEvent`, que ya registra lo que
 * hace (E0, 23/9); no hay tabla nueva.
 *
 * Un **paso** es algo que el estudiante terminó él mismo: un tema leído o visto hasta el final,
 * una actividad enviada o un examen entregado. No cuenta la aprobación de una actividad (la
 * hace el instructor, otro día) ni lo marcado a mano por el equipo. Un **día activo** es un día
 * con cualquier evento suyo, aunque no terminara nada: abrir un tema ya es estudiar.
 *
 * Días en la zona de Bogotá, como todo lo que el estudiante lee con fecha.
 */

import 'server-only';

import { bogotaDate } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';

export interface StudyDay {
  /** AAAA-MM-DD en Bogotá. */
  date: string;
  steps: number;
  active: boolean;
}

export interface StudyActivity {
  /** Del más antiguo a hoy; siempre `days` elementos. */
  days: StudyDay[];
  activeDays: number;
  /** Pasos de los últimos 7 días y de los 7 anteriores, para decir si sube o baja. */
  thisWeek: number;
  lastWeek: number;
}

const STEP_TYPES = ['lesson.completed', 'lesson.submission.sent', 'attempt.submitted'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ¿Este evento es un paso que dio el propio estudiante? */
export function isStudentStep(event: { type: string; payload: unknown }): boolean {
  if (!(STEP_TYPES as readonly string[]).includes(event.type)) return false;
  if (event.type !== 'lesson.completed') return true;
  const payload = (event.payload ?? {}) as { form?: unknown; source?: unknown };
  // La actividad cuenta al enviarla; su `lesson.completed` llega al aprobarla (o al enviarla
  // con aprobación automática) y contarlo también sería doble. Lo manual es del equipo.
  return payload.form !== 'SUBMISSION' && payload.source !== 'MANUAL';
}

/** Los días de la ventana, del más antiguo a hoy, en Bogotá. */
export function windowDays(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    bogotaDate(new Date(now.getTime() - (days - 1 - i) * DAY_MS))
  );
}

export function summarizeActivity(
  events: Array<{ type: string; payload: unknown; occurredAt: Date }>,
  now: Date,
  days = 14
): StudyActivity {
  const keys = windowDays(now, days);
  const byDay = new Map(keys.map((date) => [date, { date, steps: 0, active: false }]));
  for (const event of events) {
    const day = byDay.get(bogotaDate(event.occurredAt));
    if (!day) continue;
    day.active = true;
    if (isStudentStep(event)) day.steps += 1;
  }
  const list = keys.map((date) => byDay.get(date)!);
  const sum = (slice: StudyDay[]) => slice.reduce((total, day) => total + day.steps, 0);
  return {
    days: list,
    activeDays: list.filter((day) => day.active).length,
    thisWeek: sum(list.slice(-7)),
    lastWeek: sum(list.slice(-14, -7)),
  };
}

export async function getStudyActivity({
  institutionId,
  personId,
  now = new Date(),
  days = 14,
}: {
  institutionId: string;
  personId: string;
  now?: Date;
  days?: number;
}): Promise<StudyActivity> {
  const db = createTenantClient(institutionId);
  // Un día de margen: el corte exacto lo hace `summarizeActivity` con la fecha de Bogotá.
  const since = new Date(now.getTime() - (days + 1) * DAY_MS);
  const events = await db.learningEvent.findMany({
    where: { studentId: personId, occurredAt: { gte: since } },
    select: { type: true, payload: true, occurredAt: true },
  });
  return summarizeActivity(events, now, days);
}
