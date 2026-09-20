/**
 * GET  /api/content/lessons — los temas del programa, con el estado de su versión más alta.
 * POST /api/content/lessons — crea un tema y le abre la versión 1 en borrador.
 * SSOT: reference/02-api/endpoints.md:55.
 *
 * El `POST` se escribió el 18/9, cuando se decidió que no habría importación desde
 * LearnDash: hasta entonces los temas iban a entrar en bloque por el importador y esta ruta
 * no hacía falta. Sin ella no había **ninguna** forma de crear un tema.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireInstitutionId, optionalText } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { listLessons, createLesson } from '@/features/content/server/lessons.service';

const query = z.object({
  subjectId: z.string().optional(),
});

type Query = z.infer<typeof query>;

export const GET = apiHandler<Query>({ schema: query, capability: 'lesson.author' })(
  async (_req, ctx, input) =>
    listLessons({
      institutionId: requireInstitutionId(ctx.institutionId),
      subjectId: input.subjectId,
    })
);

const body = z.object({
  moduleId: z.string().cuid(),
  subjectId: z.string().cuid(),
  title: z.string().trim().min(1, 'El tema necesita un título').max(200),
  requiresSubmission: z.boolean().optional(),
  /**
   * `.optional()` **además** de `optionalText`: son dos cosas distintas y confundirlas
   * dejó rota la creación de contenido desde el 18/9. `optionalText` dice que el texto
   * puede venir vacío; `.optional()` dice que la clave puede no venir. El formulario de
   * creación no tiene campo de objetivo —se escribe después, en el editor— así que nunca
   * mandaba la clave, y el 400 decía «Invalid request body» sin más.
   */
  learningObjective: optionalText(500).optional(),
});

type Body = z.infer<typeof body>;

export const POST = apiHandler<Body>({ schema: body, capability: 'lesson.author' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return createLesson({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    moduleId: input.moduleId,
    subjectId: input.subjectId,
    title: input.title,
    requiresSubmission: input.requiresSubmission,
    learningObjective: input.learningObjective,
  });
});
