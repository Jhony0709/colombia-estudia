/**
 * Área del aliado (19/9): quien financia una cohorte ve su avance y, en la Fase 5, su cartera.
 * SSOT: reference/01-routing/routes.md:45, plan/08 §7, acceso-y-cartera.md (alcance `partnerId`).
 *
 * La guardia es tener `progress.read.cohort` con algún alcance de aliado. Sin cabecera de
 * navegación: hay una sola pantalla.
 */

import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import { SpaceSwitcher } from '@/components/molecules/space-switcher';
import { LogoutButton } from '@/components/organisms/logout-dialog';
import { buildSpaces } from '@/lib/nav/spaces';

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequestContext();
  if (!ctx.person) redirect('/auth/login');
  const scopes = ctx.capabilities.get('progress.read.cohort') ?? [];
  if (!scopes.some((s) => 'partnerId' in s)) redirect(HOME_AFTER_LOGIN);

  return (
    <>
      <header className="bg-surface-base border-border-muted border-b">
        <div className="max-w-site mx-auto flex items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <SpaceSwitcher
            institutionName={ctx.institution.name}
            spaces={buildSpaces(ctx.capabilities)}
            homeHref="/aliado"
          />
          <div className="flex items-center gap-3">
            <span className="type-caption text-text-muted hidden sm:inline">
              {ctx.person.givenName} {ctx.person.familyName}
            </span>
            <LogoutButton className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch inline-flex items-center gap-1.5 px-2" />
          </div>
        </div>
      </header>
      <main id="contenido">{children}</main>
    </>
  );
}
