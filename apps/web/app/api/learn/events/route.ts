/**
 * POST /api/learn/events — un evento de uso declarado por el cliente (E0, 23/9).
 * SSOT: reference/02-api/endpoints.md, docs/ux/decision-estudiante-2309.md.
 *
 * Solo dos tipos y un payload cerrado (`events.service.ts`). Con límite por persona: es
 * un `fetch` con `keepalive` que se dispara al pintar y al pulsar, y un cliente roto no
 * tiene que poder llenar la tabla.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { rateLimit } from '@/lib/http/rate-limit';
import { recordStudentEvent } from '@/features/learn/server/events.service';
import {
  REQUEST_OUTCOMES,
  STUDENT_ACTIONS,
  STUDENT_EVENT_TYPES,
  STUDENT_FORMS,
  STUDENT_REQUESTS,
  STUDENT_SCREENS,
} from '@/lib/telemetry/student-events';

const schema = z.object({
  type: z.enum(STUDENT_EVENT_TYPES),
  enrollmentId: z.string().cuid().nullable().optional(),
  payload: z.object({
    screen: z.enum(STUDENT_SCREENS),
    action: z.enum(STUDENT_ACTIONS),
    assignmentId: z.string().cuid().optional(),
    form: z.enum(STUDENT_FORMS).optional(),
    request: z.enum(STUDENT_REQUESTS).optional(),
    outcome: z.enum(REQUEST_OUTCOMES).optional(),
    // Un día en milisegundos: por encima no es una petición, es un cliente roto.
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
  }),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.progress.own' })(async (
  _req,
  _routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  const limit = rateLimit({ key: `events:${ctx.person.id}`, limit: 120, windowMs: 60_000 });
  if (!limit.allowed) throw new APIError('Demasiados eventos', 'RATE_LIMITED');

  await recordStudentEvent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    enrollmentId: input.enrollmentId ?? null,
    type: input.type,
    payload: input.payload,
  });
  return { ok: true };
});
