/**
 * Tests for dates.ts
 * SSOT: reference/04-business-logic/acceso-y-cartera.md:98
 */

import { bogotaDate, calculateAgeAt, dateOnly, endOfBogotaDay } from './dates';

describe('bogotaDate', () => {
  it('04:59 UTC → previous day in Bogota (23:59 COT)', () => {
    // 2024-06-15 04:59 UTC = 2024-06-14 23:59 COT (Bogota is UTC-5)
    const utc = new Date('2024-06-15T04:59:00.000Z');
    expect(bogotaDate(utc)).toBe('2024-06-14');
  });

  it('05:00 UTC → same day in Bogota (00:00 COT)', () => {
    // 2024-06-15 05:00 UTC = 2024-06-15 00:00 COT
    const utc = new Date('2024-06-15T05:00:00.000Z');
    expect(bogotaDate(utc)).toBe('2024-06-15');
  });

  it('12:00 UTC → same day in Bogota (07:00 COT)', () => {
    const utc = new Date('2024-06-15T12:00:00.000Z');
    expect(bogotaDate(utc)).toBe('2024-06-15');
  });

  it('23:00 UTC → same day in Bogota (18:00 COT)', () => {
    const utc = new Date('2024-06-15T23:00:00.000Z');
    expect(bogotaDate(utc)).toBe('2024-06-15');
  });

  it('crosses 05:00 UTC boundary correctly - before', () => {
    // Just before midnight in Bogota
    const utc = new Date('2024-12-31T04:59:59.999Z');
    expect(bogotaDate(utc)).toBe('2024-12-30');
  });

  it('crosses 05:00 UTC boundary correctly - after', () => {
    // Just after midnight in Bogota (new year)
    const utc = new Date('2024-12-31T05:00:00.000Z');
    expect(bogotaDate(utc)).toBe('2024-12-31');
  });
});

describe('dateOnly', () => {
  it('extracts ISO date from midnight UTC', () => {
    const d = new Date('2024-06-15T00:00:00.000Z');
    expect(dateOnly(d)).toBe('2024-06-15');
  });

  it('extracts ISO date regardless of time', () => {
    const d = new Date('2024-06-15T23:59:59.999Z');
    expect(dateOnly(d)).toBe('2024-06-15');
  });

  it('handles year boundaries', () => {
    const d = new Date('2025-01-01T00:00:00.000Z');
    expect(dateOnly(d)).toBe('2025-01-01');
  });
});

describe('endOfBogotaDay', () => {
  it('returns 23:59:59.999 Bogota as UTC', () => {
    const d = new Date('2024-06-15T00:00:00.000Z');
    const end = endOfBogotaDay(d);

    // 2024-06-15 23:59:59.999 COT = 2024-06-16 04:59:59.999 UTC
    expect(end.toISOString()).toBe('2024-06-16T04:59:59.999Z');
  });

  it('end of day is after start of same day in Bogota', () => {
    const d = new Date('2024-06-15T00:00:00.000Z');
    const end = endOfBogotaDay(d);

    // 05:00 UTC = 00:00 COT of 2024-06-15
    const startOfDayBogota = new Date('2024-06-15T05:00:00.000Z');

    expect(end.getTime()).toBeGreaterThan(startOfDayBogota.getTime());
  });

  it('end of day is before start of next day in Bogota', () => {
    const d = new Date('2024-06-15T00:00:00.000Z');
    const end = endOfBogotaDay(d);

    // 05:00 UTC of 2024-06-16 = 00:00 COT of 2024-06-16
    const startOfNextDayBogota = new Date('2024-06-16T05:00:00.000Z');

    expect(end.getTime()).toBeLessThan(startOfNextDayBogota.getTime());
  });

  it('handles year boundary', () => {
    const d = new Date('2024-12-31T00:00:00.000Z');
    const end = endOfBogotaDay(d);

    // 2024-12-31 23:59:59.999 COT = 2025-01-01 04:59:59.999 UTC
    expect(end.toISOString()).toBe('2025-01-01T04:59:59.999Z');
  });
});

describe('calculateAgeAt', () => {
  it('calculates age correctly for completed years', () => {
    // birthDate: 2000-06-15 (stored as midnight UTC)
    const birth = new Date('2000-06-15T00:00:00.000Z');
    // at: 2024-06-16 12:00 UTC = 2024-06-16 07:00 COT (after birthday)
    const at = new Date('2024-06-16T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(24);
  });

  it('does not count incomplete year before birthday', () => {
    // birthDate: 2000-06-15
    const birth = new Date('2000-06-15T00:00:00.000Z');
    // at: 2024-06-14 12:00 UTC = 2024-06-14 07:00 COT (before birthday)
    const at = new Date('2024-06-14T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(23);
  });

  it('counts birthday as completed year on the same day', () => {
    // birthDate: 2000-06-15
    const birth = new Date('2000-06-15T00:00:00.000Z');
    // at: 2024-06-15 12:00 UTC = 2024-06-15 07:00 COT (on birthday)
    const at = new Date('2024-06-15T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(24);
  });

  it('handles timezone boundary - just before midnight in Bogota', () => {
    // birthDate: 2006-09-16
    const birth = new Date('2006-09-16T00:00:00.000Z');
    // at: 2024-09-16 04:59 UTC = 2024-09-15 23:59 COT (still before birthday in Bogota)
    const at = new Date('2024-09-16T04:59:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(17); // Still 17, not 18 yet in Bogota
  });

  it('handles timezone boundary - just after midnight in Bogota', () => {
    // birthDate: 2006-09-16
    const birth = new Date('2006-09-16T00:00:00.000Z');
    // at: 2024-09-16 05:00 UTC = 2024-09-16 00:00 COT (birthday in Bogota)
    const at = new Date('2024-09-16T05:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(18);
  });

  it('returns 17 for someone born on 2008-09-17 checked on 2026-09-16', () => {
    // This is today's date per the system prompt
    const birth = new Date('2008-09-17T00:00:00.000Z');
    const at = new Date('2026-09-16T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(17); // Birthday is tomorrow
  });

  it('returns 18 for someone born on 2008-09-16 checked on 2026-09-16', () => {
    const birth = new Date('2008-09-16T00:00:00.000Z');
    const at = new Date('2026-09-16T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(18); // Birthday is today
  });

  it('handles year boundaries correctly', () => {
    // birthDate: 2010-01-01
    const birth = new Date('2010-01-01T00:00:00.000Z');
    // at: 2024-12-31 12:00 UTC = 2024-12-31 07:00 COT (before birthday)
    const at = new Date('2024-12-31T12:00:00.000Z');

    expect(calculateAgeAt(birth, at)).toBe(14);
  });
});
