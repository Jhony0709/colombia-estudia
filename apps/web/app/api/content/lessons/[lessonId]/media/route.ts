/**
 * GET /api/content/lessons/[lessonId]/media — los medios que el tema referencia.
 * SSOT: plan/07-contenido-y-migracion.md:35, revisión de UX del 18/9.
 * Registrada en endpoints.md.
 *
 * `no-store`: dice qué video de Vimeo lleva cada tema, y eso no se cachea en un intermedio.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { listLessonMedia } from '@/features/content/server/lesson-media.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const GET = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  _ctx,
  input
) => {
  const items = await listLessonMedia({
    institutionId: requireInstitutionId(_ctx.institutionId),
    versionId: input.versionId,
  });

  return NextResponse.json(
    { data: { items } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
});
