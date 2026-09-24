'use client';

/**
 * Elige la foto y el titular del `AuthShell` según la pantalla de `/auth/*`: iniciar sesión
 * tiene la suya; recuperar, restablecer y el segundo factor comparten la de «volver a
 * entrar». El layout es de servidor y no sabe el segmento; esto sí.
 */

import { useSelectedLayoutSegment } from 'next/navigation';
import { AuthShell, type AuthIntent } from '@/components/templates/auth-shell';

const INTENT_BY_SEGMENT: Record<string, AuthIntent> = {
  login: 'login',
  recuperar: 'recover',
  restablecer: 'recover',
  mfa: 'recover',
};

export function AuthFrame({
  dataPolicyUrl,
  children,
}: {
  dataPolicyUrl: string | null;
  children: React.ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const intent: AuthIntent = (segment ? INTENT_BY_SEGMENT[segment] : undefined) ?? 'login';
  return (
    <AuthShell intent={intent} dataPolicyUrl={dataPolicyUrl}>
      {children}
    </AuthShell>
  );
}
