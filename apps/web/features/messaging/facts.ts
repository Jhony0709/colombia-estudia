/**
 * Lo que el bot afirma del programa (14/11, Jhonny/Kris). Los componentes y su precio salen de
 * la plataforma (`server/facts.service.ts`); estos son los valores cuando no hay programa con
 * precio vigente, y los que la plataforma todavía no guarda (grado y certificado).
 */
export interface Facts {
  modules: number;
  modulePrice: number;
  graduationFee: number;
  certificatePrice: number;
  certificateBusinessDays: number;
  minAge: number;
  months: number;
  /** Fecha de grado: «por definir» hasta que se agregue a la plataforma. */
  graduation: string | null;
}

export const DEFAULT_FACTS: Facts = {
  modules: 6,
  modulePrice: 90_000,
  graduationFee: 350_000,
  certificatePrice: 11_000,
  certificateBusinessDays: 3,
  minAge: 16,
  months: 6,
  graduation: null,
};

/** Pesos colombianos: `$890.000`. */
export const cop = (n: number) => `$${n.toLocaleString('es-CO')}`;

/**
 * Horario de los asesores (22/11): el bot atiende 24/7; las personas, en este horario de Bogotá.
 * PROPUESTA de Jhonny por confirmar: lunes a sábado, 8:00 a 18:00.
 */
export const ADVISOR_HOURS = { days: [1, 2, 3, 4, 5, 6], from: 8, to: 18 };
export const ADVISOR_HOURS_TEXT = 'de lunes a sábado, de 8:00 a. m. a 6:00 p. m.';

/** ¿Hay asesores en este momento? Bogotá es UTC−5 todo el año (sin horario de verano). */
export function advisorsOpen(now: Date): boolean {
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const day = bogota.getUTCDay();
  const hour = bogota.getUTCHours();
  return ADVISOR_HOURS.days.includes(day) && hour >= ADVISOR_HOURS.from && hour < ADVISOR_HOURS.to;
}
