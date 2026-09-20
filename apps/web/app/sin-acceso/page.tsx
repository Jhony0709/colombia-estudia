/**
 * No access page.
 * SSOT: plan/03-identidad-y-acceso.md
 *
 * Shown when a user has no recognized role/membership.
 */

import { getRequestContext } from '@/lib/authz/request-context';

export default async function NoAccessPage() {
  const ctx = await getRequestContext();

  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="type-heading text-text">Sin acceso</h1>
        <p className="type-body text-text-muted">
          No tienes acceso a ninguna área de la plataforma.
        </p>
        <p className="type-body text-text">
          Contacta a {ctx.institution.supportEmail} para más información.
        </p>
      </div>
    </main>
  );
}
