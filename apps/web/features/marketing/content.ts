/**
 * Capa de datos de la portada. Hoy son textos fijos (Jhonny, 19/9; ALBA, 5/10): un programa,
 * el bachillerato acelerado, y tres servicios que vienen con él (no son productos aparte).
 * Cuando haya más de un programa con descripción, esto se sustituye por `Program` de la base
 * sin tocar las secciones. Las claves apuntan a `landing.programs.*`: aquí no hay copy.
 */

import type { MediaId } from './media';

export interface FeaturedProgram {
  /** Clave de i18n bajo `landing.programs.featured`. */
  key: 'bachillerato';
  media: MediaId;
}

export interface ProgramService {
  /** Clave de i18n bajo `landing.programs.services`. */
  key: 'start' | 'tutor' | 'diploma';
  /** Dónde se explica: la tarjeta lleva ahí. */
  href: string;
}

export const FEATURED_PROGRAM: FeaturedProgram = { key: 'bachillerato', media: 'home-program' };

export const PROGRAM_SERVICES: readonly ProgramService[] = [
  { key: 'start', href: '#preguntas' },
  { key: 'tutor', href: '#como-funciona' },
  { key: 'diploma', href: '#preguntas' },
];
