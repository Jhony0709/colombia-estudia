/**
 * Capa de datos de la portada. Hoy son textos fijos (Jhonny, 19/9); cuando haya más de un
 * programa con descripción, esto se sustituye por `Program` de la base sin tocar las
 * secciones. Las claves apuntan a `landing.*` en es-CO.json: aquí no hay copy.
 */

import type { MediaId } from './media';

export interface ProgramCard {
  /** Clave de i18n bajo `landing.programs.items`. */
  key: 'bachillerato';
  media: MediaId;
}

export const PROGRAMS: readonly ProgramCard[] = [
  { key: 'bachillerato', media: 'program-bachillerato' },
];
