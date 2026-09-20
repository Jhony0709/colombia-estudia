/**
 * POST /api/content/lessons/[lessonId]/preview — el HTML del borrador, ya saneado.
 * SSOT: plan/07-contenido-y-migracion.md:35.
 * AMBIGUO: ruta añadida en §3b. Registrada en endpoints.md.
 *
 * Renderiza lo **guardado**, como la validación: así la vista previa y los avisos hablan
 * siempre del mismo texto, y del mismo que se publicaría.
 *
 * `no-store` porque el HTML lleva dentro URLs firmadas de diez minutos. Una respuesta
 * cacheada sería un enlace al bucket privado guardado en algún sitio.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { previewDraft } from '@/features/content/server/preview.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  ctx,
  input
) => {
  const result = await previewDraft({
    institutionId: requireInstitutionId(ctx.institutionId),
    versionId: input.versionId,
  });

  return NextResponse.json(
    { data: result },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
});
