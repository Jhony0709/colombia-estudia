/**
 * Auth layout.
 * SSOT: plan/03-identidad-y-acceso.md §Flujos
 *
 * 23/9: el cascarón a dos columnas (`AuthShell`), con la foto según la pantalla
 * (`AuthFrame`). Sin navegación. La política de datos de la institución va al pie.
 */

import type { Metadata } from 'next';
import { getRequestContext } from '@/lib/authz/request-context';
import { AuthFrame } from './auth-frame';

// Pantallas de proceso fuera del índice; el login lo reabre (D3, 11/10).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequestContext();
  return <AuthFrame dataPolicyUrl={ctx.institution.dataPolicyUrl ?? null}>{children}</AuthFrame>;
}
