/**
 * Login page.
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Server component wrapping LoginContent in Suspense.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginContent from './login-content';

export const metadata: Metadata = {
  title: 'Inicia sesión',
  description: 'Entra a tu cuenta de ALBA Futuro Educativo para continuar tu bachillerato.',
  alternates: { canonical: '/auth/login' },
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section>
          <h1 className="auth-title text-text">Inicia sesión</h1>
          <div className="bg-surface-sunken rounded-card h-64 animate-pulse" />
        </section>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
