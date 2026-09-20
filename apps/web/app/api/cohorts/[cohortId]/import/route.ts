/**
 * POST /api/cohorts/[cohortId]/import — los tres pasos de la carga CSV.
 * SSOT: plan/06-cohortes-y-personas.md:38-56.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido aquí junto a §14a.
 *
 * Un solo endpoint y un solo `mode`, en vez de tres rutas: el ensayo, la descarga de
 * errores y la confirmación corren **exactamente la misma validación** sobre el mismo
 * archivo. Separarlos invitaría a que una de las tres se quedara atrás.
 *
 * El archivo viaja como texto dentro del JSON y no como `multipart/form-data`: el cliente
 * ya lee el fichero para enseñar el nombre y el tamaño, y así el cuerpo pasa por el mismo
 * Zod y el mismo CSRF que el resto de la API, sin un parser aparte.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  dryRunImport,
  commitImport,
  errorsCsv,
} from '@/features/cohorts/server/import/import.service';

/**
 * Dos millones de caracteres: muy por encima de las 2000 filas que admite el importador
 * y muy por debajo de lo que haría daño tener en memoria.
 */
const MAX_CSV_CHARS = 2_000_000;

const schema = z.object({
  csv: z
    .string()
    .min(1, 'El archivo está vacío')
    .max(MAX_CSV_CHARS, 'El archivo es demasiado grande; pártelo en varios'),
  mode: z.enum(['dry-run', 'errors-csv', 'commit']),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input, unknown>({ schema, capability: 'cohort.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const cohortId = await routeParam(ctx.params, 'cohortId');

  if (input.mode === 'commit') {
    // `actorId` no puede ser nulo aquí: `ImportRun.startedById` es obligatorio, y una
    // importación sin responsable es justo lo que la auditoría existe para evitar.
    const actorId = ctx.personId;
    if (!actorId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Sin persona en la sesión' } },
        { status: 403 }
      );
    }

    return commitImport({ institutionId, actorId, cohortId, csv: input.csv });
  }

  const result = await dryRunImport({ institutionId, cohortId, csv: input.csv });

  if (input.mode === 'errors-csv') {
    return new NextResponse(errorsCsv(result.rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="errores-importacion.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  return result;
});
