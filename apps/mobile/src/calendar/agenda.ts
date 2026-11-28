import type { CalendarItem } from './api';

// Los cortes de apps/web/app/(student)/aprender/calendario/page.tsx:46-100: es cómo se pinta, no
// quién puede qué (eso lo dice el servidor con `joinable`, `href` y `done`).
const TIME_ZONE = 'America/Bogota';
const DAY_MS = 86_400_000;

/** Inicio, fin y fin de acceso son días (medianoche UTC), no instantes. */
export const isDateOnly = (item: CalendarItem) =>
  item.kind !== 'LIVE_SESSION' && item.kind !== 'ASSESSMENT_DUE';

const dayKey = (date: Date, dateOnly: boolean) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: dateOnly ? 'UTC' : TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const dayNumber = (key: string) =>
  Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / DAY_MS;

export type Bucket = 'today' | 'week' | 'later';

export function agenda(items: CalendarItem[], now = Date.now()) {
  const today = dayNumber(dayKey(new Date(now), false));
  const daysUntil = (item: CalendarItem) =>
    dayNumber(dayKey(new Date(item.at), isDateOnly(item))) - today;
  const live = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() >= now);
  const past = items.filter((i) => new Date(i.endsAt ?? i.at).getTime() < now).reverse();
  const access = live.filter((i) => i.kind === 'ACCESS_UNTIL');
  const buckets: Record<Bucket, CalendarItem[]> = { today: [], week: [], later: [] };
  for (const item of live.filter((i) => i.kind !== 'ACCESS_UNTIL')) {
    const days = daysUntil(item);
    buckets[days <= 0 ? 'today' : days <= 7 ? 'week' : 'later'].push(item);
  }
  return { buckets, past, access, daysUntil };
}

/** La fecha y, si es un instante, la hora en Bogotá. */
export function when(item: CalendarItem): string {
  const date = new Date(item.at);
  const dateOnly = isDateOnly(item);
  const day = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: dateOnly ? 'UTC' : TIME_ZONE,
  });
  if (dateOnly) return day;
  const time = date.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
  return `${day}, ${time}`;
}
