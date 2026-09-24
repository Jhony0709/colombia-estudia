/**
 * Registro público (Fase B). Mismo cascarón que `/auth/*` (23/9), con su propia foto.
 */

import { getRequestContext } from '@/lib/authz/request-context';
import { AuthShell } from '@/components/templates/auth-shell';

export default async function RegistrationLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequestContext();
  return (
    <AuthShell intent="register" dataPolicyUrl={ctx.institution.dataPolicyUrl ?? null}>
      {children}
    </AuthShell>
  );
}
