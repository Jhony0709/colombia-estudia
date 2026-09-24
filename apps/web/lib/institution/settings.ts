/**
 * `Institution.settings` (JSON), leído y escrito por un solo sitio.
 * SSOT: prisma/schema.prisma (`Institution.settings`: «validado con Zod; nada de negocio
 * crítico aquí»), docs/plan-redefinicion-2009.md Fase B (`introCohortId`).
 *
 * Es un JSON abierto a propósito: lo que aún no tiene columna vive aquí mientras se decide
 * si la merece. Lo que no se conoce se conserva (`passthrough`): un ajuste que otra parte
 * escribió no se borra por guardar este.
 */

import { z } from 'zod';

export const institutionSettingsSchema = z
  .object({
    /**
     * La cohorte en la que entra quien se registra por `/registro` (Fase B). Nula o
     * ausente = el registro crea la persona y avisa que operación la matriculará.
     */
    introCohortId: z.string().cuid().nullable().optional(),
  })
  .passthrough();

export type InstitutionSettings = z.infer<typeof institutionSettingsSchema>;

/** Lo guardado, o vacío si no hay nada o no tiene la forma esperada. Nunca lanza. */
export function parseInstitutionSettings(raw: unknown): InstitutionSettings {
  const parsed = institutionSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
