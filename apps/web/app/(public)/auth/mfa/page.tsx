/**
 * MFA page.
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Server component that wraps MfaContent in Suspense boundary
 * to handle useSearchParams correctly in static generation.
 */

import { Suspense } from 'react';
import MfaContent from './mfa-content';

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <section className="flex items-center justify-center">
          <div className="type-body text-text-muted animate-pulse">Cargando...</div>
        </section>
      }
    >
      <MfaContent />
    </Suspense>
  );
}
