/**
 * PUT y DELETE /api/push/devices — el teléfono de quien pregunta, para el push.
 * SSOT: reference/02-api/endpoints.md, reference/03-ui/movil.md «Push».
 *
 * Sin capacidad, como `/api/notifications`: cada quien registra y borra **el suyo**, y el
 * `personId` sale del contexto de la petición.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { registerDevice, removeDevice } from '@/features/notifications/server/push.service';

const token = z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/);
const PLATFORM = { ios: 'IOS', android: 'ANDROID' } as const;

async function owner(req: Request) {
  enforceRateLimit(req, 'push-devices', 20, 10 * 60_000);
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return { institutionId: ctx.institution.id, personId: ctx.person.id };
}

export const PUT = apiHandler({
  schema: z.object({ token, platform: z.enum(['ios', 'android']) }),
})(async (req, _ctx, body) =>
  registerDevice({ ...(await owner(req)), token: body.token, platform: PLATFORM[body.platform] })
);

export const DELETE = apiHandler({ schema: z.object({ token }) })(async (req, _ctx, body) =>
  removeDevice({ ...(await owner(req)), token: body.token })
);
