/**
 * Login page.
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Server component wrapping LoginContent in Suspense.
 */

import { Suspense } from 'react';
import LoginContent from './login-content';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="type-heading text-text text-center">Iniciar sesión</h1>
          <div className="bg-surface-sunken rounded-card h-64 animate-pulse" />
        </section>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
