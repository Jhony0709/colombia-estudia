/**
 * POST /api/invitations/[token]/accept
 * SSOT: plan/03-identidad-y-acceso.md "Invitación (3 pasos, móvil)" paso 2, routes.md:24
 *
 * Public endpoint (the token is the credential). Validates the token and the data-policy
 * acceptance, registers the account (features/auth/server/invitations.service) and starts
 * the session server-side so the cookies are HttpOnly (plan/03 "Sesión").
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { validateInvitationToken } from '@/lib/invitations/validate-token';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { acceptInvitation } from '@/features/auth/server/invitations.service';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';

const schema = z.object({
  password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres'),
  acceptsDataPolicy: z.boolean().optional(),
});

export const POST = apiHandler({ schema })(async (_req, ctx, { password, acceptsDataPolicy }) => {
  const { token } = await ctx.params;
  if (typeof token !== 'string' || token.length === 0) {
    throw new APIError('Invalid token', 'VALIDATION_ERROR');
  }

  const result = await validateInvitationToken(token);
  switch (result.status) {
    case 'not_found':
      throw new APIError('Invitation not found', 'NOT_FOUND');
    case 'expired':
      // AMBIGUO(errors.md): no code of its own for invitations; ACCESS_EXPIRED (410) is the
      // closest and errors.ts is protected.
      throw new APIError('Invitation has expired', 'ACCESS_EXPIRED');
    case 'used':
      throw new APIError('Invitation has already been used', 'ACCESS_EXPIRED');
    case 'already_registered':
      throw new APIError('Account already registered', 'CONFLICT');
  }

  // Adults accept the data policy explicitly (literal true). Minors: the guardian signed on paper.
  if (!result.isMinor && acceptsDataPolicy !== true) {
    throw new APIError('Debes aceptar la política de tratamiento de datos', 'CONSENT_REQUIRED');
  }

  const { email } = await acceptInvitation({
    invitationId: result.invitationId,
    institutionId: result.institutionId,
    personId: result.personId,
    isMinor: result.isMinor,
    dataPolicyVersion: result.dataPolicyVersion,
    password,
  });

  // If the sign-in fails the account already exists: the user logs in normally.
  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  // `/` sends each role to its area and to /auth/mfa when needed.
  return { next: signInError ? '/auth/login' : HOME_AFTER_LOGIN };
});
