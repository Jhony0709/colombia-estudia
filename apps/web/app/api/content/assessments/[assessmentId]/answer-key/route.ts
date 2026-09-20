/**
 * GET /api/content/assessments/[assessmentId]/answer-key — la clave, sola.
 * PUT …                                                  — la guarda, sola.
 * SSOT: plan/07-contenido-y-migracion.md:40-44 — "`answerKey` en un panel aparte
 * (visualmente separado y nunca en el mismo objeto)".
 * AMBIGUO: ruta añadida en §4. Registrada en endpoints.md.
 *
 * Existe como ruta propia precisamente para que el separar no dependa de que nadie se
 * despiste: aquí no hay forma de devolver las preguntas junto a las respuestas.
 *
 * `Cache-Control: no-store` y nada de `GET` con caché de Next: esta respuesta es el examen
 * resuelto.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { getAnswerKey, saveAnswerKey } from '@/features/content/server/assessments.service';

const query = z.object({ versionId: z.string().cuid() });

type Query = z.infer<typeof query>;

export const GET = apiHandler<Query>({ schema: query, capability: 'lesson.author' })(async (
  _req,
  ctx,
  input
) => {
  const result = await getAnswerKey({
    institutionId: requireInstitutionId(ctx.institutionId),
    versionId: input.versionId,
  });

  return NextResponse.json(
    { data: result },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
});

const body = z.object({
  versionId: z.string().cuid(),
  answerKey: z.record(z.string(), z.unknown()),
});

type Body = z.infer<typeof body>;

export const PUT = apiHandler<Body>({ schema: body, capability: 'lesson.author' })(async (
  _req,
  ctx,
  input
) => {
  if (Object.keys(input.answerKey).length === 0) {
    throw new APIError('La clave de respuestas no puede quedar vacía', 'VALIDATION_ERROR');
  }

  return saveAnswerKey({
    institutionId: requireInstitutionId(ctx.institutionId),
    versionId: input.versionId,
    answerKey: input.answerKey,
  });
});
