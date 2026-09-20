/**
 * PUT /api/admin/institution
 * SSOT: plan/06-cohortes-y-personas.md:17 (PUT /api/admin/institution → AuditLog institution.updated)
 *
 * Brand, contact, legal data and data policy. Requires `institution.manage`.
 * The tenant identity (slug, primaryDomain) is NOT editable here: it is deployment
 * configuration, not institution settings.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { updateInstitution } from '@/features/admin/server/institution.service';

/**
 * Optional text fields travel as strings, empty when unset: the schema keeps input and
 * output types identical (no `preprocess`/`transform`, which apiHandler's `ZodSchema<T>`
 * would reject) and the blank-to-null normalisation happens below, in one place.
 */
const optionalText = (max: number) => z.union([z.literal(''), z.string().trim().max(max)]);

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  legalName: optionalText(160),
  taxId: optionalText(40),
  brandColor: z.union([
    z.literal(''),
    z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB'),
  ]),
  supportEmail: z.string().trim().email('Correo de soporte inválido'),
  supportPhone: optionalText(40),
  emailFromName: z.string().trim().min(1, 'El nombre del remitente es obligatorio').max(80),
  dataPolicyUrl: z.union([z.literal(''), z.string().trim().url('URL de política inválida')]),
  dataPolicyVersion: z.string().trim().min(1, 'La versión es obligatoria').max(20),
});

type Input = z.infer<typeof schema>;

/** An empty field means "no value", not an empty string, in the database. */
const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export const PUT = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  ctx,
  input
) => {
  // apiHandler already validated the body and filled these in (it resolves the request
  // context to check the capability). The body stream is consumed there: never re-read it.
  if (!ctx.institutionId) {
    throw new APIError('Missing institution context', 'INTERNAL');
  }

  return updateInstitution({
    institutionId: ctx.institutionId,
    actorId: ctx.personId ?? null,
    data: {
      name: input.name.trim(),
      legalName: blankToNull(input.legalName),
      taxId: blankToNull(input.taxId),
      brandColor: blankToNull(input.brandColor),
      supportEmail: input.supportEmail.trim(),
      supportPhone: blankToNull(input.supportPhone),
      emailFromName: input.emailFromName.trim(),
      dataPolicyUrl: blankToNull(input.dataPolicyUrl),
      dataPolicyVersion: input.dataPolicyVersion.trim(),
    },
  });
});
