/**
 * POST /api/auth/reset
 * SSOT: plan/03-identidad-y-acceso.md §Recuperación
 *
 * Updates the user's password. The session comes from the recovery callback.
 * Password must be at least 12 characters (NIST 800-63B).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';

const schema = z.object({
  password: z.string().min(12, 'Mínimo 12 caracteres'),
});

export const POST = apiHandler({
  schema,
})(async (_req, _ctx, { password }) => {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // supabase-js AuthError carries a stable `code`; the message text is not a contract.
    // weak_password covers length and the leaked-password check (Supabase setting).
    if (error.code === 'weak_password') {
      throw new APIError(
        'Esa contraseña es demasiado débil o apareció en filtraciones de datos; elige otra',
        'VALIDATION_ERROR'
      );
    }
    if (error.code === 'same_password') {
      throw new APIError(
        'La contraseña nueva debe ser distinta de la anterior',
        'VALIDATION_ERROR'
      );
    }
    throw new APIError('Sesión expirada. Solicita un nuevo enlace.', 'UNAUTHENTICATED');
  }

  return { success: true };
});
