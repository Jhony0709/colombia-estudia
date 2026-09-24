/**
 * POST /api/auth/register — registro público (Fase B, 23/9).
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1, reference/02-api/endpoints.md (Auth).
 *
 * Sin sesión, con límite por IP (`lib/http/rate-limit.ts`: por instancia, vale contra un
 * bucle, no contra un ataque distribuido). Crea la cuenta y arranca la sesión en el
 * servidor, como `POST /api/invitations/[token]/accept`, para que las cookies sean HttpOnly.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { rateLimit, clientKey } from '@/lib/http/rate-limit';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { resolveInstitutionBySlug } from '@/lib/authz/institution-cache';
import { COLOMBIA_ESTUDIA } from '@/lib/authz/tenant';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import { registerPerson } from '@/features/auth/server/registration.service';

const schema = z.object({
  givenName: z.string().trim().min(1, 'Escribe tu nombre').max(80),
  familyName: z.string().trim().min(1, 'Escribe tu apellido').max(80),
  email: z.string().trim().email('Correo inválido').max(160),
  phone: z.union([z.literal(''), z.string().trim().max(40)]),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  // Mismo mínimo que la invitación (`/api/invitations/[token]/accept`): 12. El plan decía 8;
  // dos mínimos distintos para la misma cuenta serían dos reglas que explicar.
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres'),
  acceptsDataPolicy: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema })(async (req, _ctx, input) => {
  const limit = rateLimit({ key: `register:${clientKey(req)}`, limit: 5, windowMs: 10 * 60_000 });
  if (!limit.allowed) {
    throw new APIError('Demasiados intentos. Espera unos minutos.', 'RATE_LIMITED');
  }

  const institution = await resolveInstitutionBySlug(COLOMBIA_ESTUDIA);
  if (!institution) throw new APIError('Institution not found', 'INTERNAL');

  const result = await registerPerson({
    institutionId: institution.id,
    givenName: input.givenName,
    familyName: input.familyName,
    email: input.email,
    phone: input.phone === '' ? null : input.phone,
    birthDate: input.birthDate,
    password: input.password,
    acceptsDataPolicy: input.acceptsDataPolicy === true,
  });

  // Si el inicio de sesión falla, la cuenta ya existe: entra por el login.
  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: result.email,
    password: input.password,
  });

  return {
    next: signInError ? '/auth/login' : HOME_AFTER_LOGIN,
    isMinor: result.isMinor,
    enrollment: result.enrollment,
  };
});
