/**
 * `Institution.settings` (JSON), leído y escrito por un solo sitio.
 * SSOT: prisma/schema.prisma (`Institution.settings`: «validado con Zod; nada de negocio
 * crítico aquí»).
 *
 * Es un JSON abierto a propósito: lo que aún no tiene columna vive aquí mientras se decide
 * si la merece. Lo que no se conoce se conserva (`passthrough`): un ajuste que otra parte
 * escribió no se borra por guardar este.
 */

import { z } from 'zod';

export const institutionSettingsSchema = z
  .object({
    // `introCohortId` vivió aquí de la Fase B (23/9) al 25/9; ahora es la columna
    // `Institution.introCohortId` (fase de negocio 3). La migración quitó la clave.
  })
  .passthrough();

export type InstitutionSettings = z.infer<typeof institutionSettingsSchema>;

/** Lo guardado, o vacío si no hay nada o no tiene la forma esperada. Nunca lanza. */
export function parseInstitutionSettings(raw: unknown): InstitutionSettings {
  const parsed = institutionSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
