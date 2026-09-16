/**
 * Date functions for Colombia Estudia.
 * SSOT: reference/04-business-logic/acceso-y-cartera.md:98
 *
 * Rule: @db.Date comes as midnight UTC. To compare with "today" in Colombia,
 * extract YYYY-MM-DD from both sides in America/Bogota timezone.
 */

const BOGOTA_TZ = 'America/Bogota';

/**
 * Returns YYYY-MM-DD in Bogota timezone for a given instant.
 * Bogota is UTC-5 (no daylight saving).
 */
export function bogotaDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Extracts YYYY-MM-DD from a @db.Date (stored as midnight UTC).
 */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns 23:59:59.999 of the day of `d` in Bogota, as a Date in UTC.
 * The student has access until the end of the day in Bogota.
 *
 * Bogota is always UTC-5 (Colombia has no daylight saving time).
 */
export function endOfBogotaDay(d: Date): Date {
  const dateStr = dateOnly(d);
  // End of day in Bogota is 23:59:59.999 COT = 04:59:59.999 UTC next day
  // Because Bogota is UTC-5, 23:59:59.999 COT = 23:59:59.999 + 5 hours = 04:59:59.999 UTC next day
  return new Date(`${dateStr}T23:59:59.999-05:00`);
}

/**
 * Parse YYYY-MM-DD string into [year, month, day] numbers.
 */
function parseDateParts(dateStr: string): [number, number, number] {
  const parts = dateStr.split('-');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * Calculate age in years at a given date, using Bogota calendar.
 *
 * @param birthDate - @db.Date (midnight UTC)
 * @param at - The date to calculate age at (typically now)
 * @returns Age in complete years
 */
export function calculateAgeAt(birthDate: Date, at: Date): number {
  // Extract YYYY-MM-DD from both dates
  const birth = dateOnly(birthDate);
  const current = bogotaDate(at);

  const [birthYear, birthMonth, birthDay] = parseDateParts(birth);
  const [currentYear, currentMonth, currentDay] = parseDateParts(current);

  let age = currentYear - birthYear;

  // Adjust if birthday hasn't occurred yet this year
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age--;
  }

  return age;
}
