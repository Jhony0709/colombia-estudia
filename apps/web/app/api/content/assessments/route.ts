/**
 * GET  /api/content/assessments — las evaluaciones del programa.
 * POST /api/content/assessments — crea una y le abre la versión 1 en borrador.
 * AMBIGUO: el contrato solo nombraba `publish`. Escrito el 18/9 junto con el de temas, por
 * la misma razón: sin importación de LearnDash no había forma de crear una evaluación.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireInstitutionId, optionalText } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { listAssessments, createAssessment } from '@/features/content/server/assessments.service';

export const GET = apiHandler({ capability: 'lesson.author' })(async (_req, ctx) =>
  listAssessments({ institutionId: requireInstitutionId(ctx.institutionId) })
);

const body = z.object({
  programId: z.string().cuid(),
  /** Nulo en una diagnóstica: es del programa, no de un módulo. */
  moduleId: z.string().cuid().nullable().optional(),
  subjectId: z.string().cuid().nullable().optional(),
  kind: z.enum(['DIAGNOSTIC', 'SUBJECT', 'FINAL']),
  title: z.string().trim().min(1, 'La evaluación necesita un título').max(200),
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

  return createAssessment({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    programId: input.programId,
    moduleId: input.moduleId,
    subjectId: input.subjectId,
    kind: input.kind,
    title: input.title,
    learningObjective: input.learningObjective,
  });
});
