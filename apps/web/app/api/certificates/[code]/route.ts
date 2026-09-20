/**
 * GET /api/certificates/[code] — verificación pública de una constancia.
 * SSOT: endpoints.md:49 («público; rate-limited; sin PII más allá del nombre»).
 *
 * Sin sesión y sin tenant: el código es único en toda la base. Con límite por IP para que
 * nadie recorra el espacio de códigos (32^10 es grande, pero gratis no es).
 */

import { NextResponse } from 'next/server';
import { getPublicCertificate } from '@/features/certificates/server/certificates.service';
import { rateLimit, clientKey } from '@/lib/http/rate-limit';
import { success, error } from '@/lib/http/responses';

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limit = rateLimit({ key: `cert:${clientKey(req)}`, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    const res = error('RATE_LIMITED', 'Demasiadas consultas. Espera un momento.', 429);
    res.headers.set('Retry-After', String(limit.retryAfterSeconds));
    return res;
  }

  const { code } = await ctx.params;
  const certificate = await getPublicCertificate(code);
  if (!certificate) return error('NOT_FOUND', 'No existe una constancia con ese código', 404);

  const res: NextResponse = success(certificate);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
