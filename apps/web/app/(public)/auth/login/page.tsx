/**
 * Login page.
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Server component wrapping LoginContent in Suspense.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getRequestContext } from '@/lib/authz/request-context';
import { sanitizeNextUrl } from '@/lib/authz/routes';
import LoginContent from './login-content';

export const metadata: Metadata = {
  title: 'Inicia sesión',
  description: 'Entra a tu cuenta de ALBA Futuro Educativo para continuar tu bachillerato.',
  alternates: { canonical: '/auth/login' },
  robots: { index: true, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Con sesión, el login no se vuelve a mostrar (p. ej. al volver atrás tras entrar).
  const ctx = await getRequestContext();
  if (ctx.person) {
    const { next } = await searchParams;
    redirect(
      ctx.mfaPending ? '/auth/mfa' : sanitizeNextUrl(typeof next === 'string' ? next : null)
    );
  }

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
