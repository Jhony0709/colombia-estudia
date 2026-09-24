/**
 * `/registro` — la persona se da de alta sola (Fase B, 23/9).
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1, reference/01-routing/routes.md.
 *
 * Con sesión no tiene sentido: `/` ya manda a cada rol a su área. Sin sesión, el
 * formulario. El nombre de la institución y la política vienen del contexto (tenant fijo).
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import RegistrationContent from './registration-content';

export const metadata: Metadata = { title: 'Regístrate' };

export default async function RegistrationPage() {
  const ctx = await getRequestContext();
  if (ctx.person) redirect(HOME_AFTER_LOGIN);

  return (
    <RegistrationContent
      institutionName={ctx.institution.name}
      dataPolicyUrl={ctx.institution.dataPolicyUrl}
    />
  );
}
