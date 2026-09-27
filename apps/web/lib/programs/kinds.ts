/**
 * Qué vende un programa (25/9, fase de negocio 2): la lista de los clientes («programas a
 * proyectar»). Vive aquí, sin `server-only`, porque la usan el formulario del programa (cliente)
 * y el servicio (servidor); el enum de Prisma es el mismo (`ProgramKind`).
 */

export type ProgramKind =
  'BACHILLERATO' | 'INGLES' | 'TECNICO' | 'REFUERZO' | 'PRE_ICFES' | 'PREGRADO' | 'OTRO';

export const PROGRAM_KINDS: readonly ProgramKind[] = [
  'BACHILLERATO',
  'INGLES',
  'TECNICO',
  'REFUERZO',
  'PRE_ICFES',
  'PREGRADO',
  'OTRO',
];

/** Gratuito o de pago (25/9, fase de negocio 3); el enum de Prisma es `ProgramPricing`. */
export type ProgramPricing = 'FREE' | 'PAID';

export const PROGRAM_PRICINGS: readonly ProgramPricing[] = ['PAID', 'FREE'];
