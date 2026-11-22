/** @jest-environment node */
/**
 * El horario de los asesores (22/11): el bot atiende siempre; las personas, lunes a sábado de
 * 8:00 a 18:00 en Bogotá. SSOT: features/messaging/facts.ts.
 */

import { advisorsOpen } from '@/features/messaging/facts';

it.each([
  ['2026-11-23T13:00:00.000Z', true], // lunes 8:00 en Bogotá
  ['2026-11-23T12:59:00.000Z', false], // lunes 7:59
  ['2026-11-23T22:59:00.000Z', true], // lunes 17:59
  ['2026-11-23T23:00:00.000Z', false], // lunes 18:00
  ['2026-11-28T15:00:00.000Z', true], // sábado 10:00
  ['2026-11-22T15:00:00.000Z', false], // domingo 10:00
  ['2026-11-24T02:00:00.000Z', false], // lunes 21:00 en Bogotá, martes en UTC
])('%s → %s', (iso, open) => {
  expect(advisorsOpen(new Date(iso))).toBe(open);
});
