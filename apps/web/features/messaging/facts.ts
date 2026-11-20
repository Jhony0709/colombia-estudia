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
