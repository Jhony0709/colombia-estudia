/**
 * Abrir la vista de estudiante desde el navegador (31/10): crea o reutiliza la matrícula de
 * prueba y devuelve adónde ir. Lo usan «Gestión» de la cohorte y el constructor del programa.
 */

import { apiErrorText } from '@/lib/http/api-error-text';

export async function openStudentPreview(
  cohortId: string,
  fallbackError: string
): Promise<{ href: string } | { error: string }> {
  try {
    const res = await fetch(`/api/cohorts/${cohortId}/preview`, { method: 'POST' });
    const payload = (await res.json().catch(() => null)) as {
      data?: { enrollmentId: string };
    } | null;
    if (!res.ok || !payload?.data) return { error: apiErrorText(payload, fallbackError) };
    return { href: `/aprender/curso/${payload.data.enrollmentId}` };
  } catch {
    return { error: fallbackError };
  }
}
