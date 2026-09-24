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
