/**
 * MFA page.
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Server component that wraps MfaContent in Suspense boundary
 * to handle useSearchParams correctly in static generation.
 */

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import MfaContent from './mfa-content';

export default async function MfaPage() {
  // Sin segundo factor pendiente no hay nada que verificar aquí.
  const ctx = await getRequestContext();
  if (ctx.person && !ctx.mfaPending) redirect(HOME_AFTER_LOGIN);

  return (
    <Suspense
      fallback={
        <section className="space-y-6">
          {/* Sin `animate-pulse`: el pulso en texto está vetado (motion-colombia-estudia). */}
          <p role="status" className="type-body text-text-muted">
            Comprobando tu configuración.
          </p>
        </section>
      }
    >
      <MfaContent />
    </Suspense>
  );
}
