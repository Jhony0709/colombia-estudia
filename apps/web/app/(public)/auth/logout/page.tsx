/**
 * Logout page.
 * SSOT: plan/03-identidad-y-acceso.md §Sesión
 *
 * POST form for logout (not GET for security).
 */

import { Button } from '@/components/atoms/button';

export default function LogoutPage() {
  return (
    <section className="space-y-6">
      <h1 className="type-heading text-text">Cerrar sesión</h1>

      <p className="type-body text-text-muted">¿Estás seguro de que deseas cerrar tu sesión?</p>

      <form action="/api/auth/logout" method="POST" className="flex flex-col gap-3">
        <Button type="submit">Cerrar sesión</Button>
      </form>
    </section>
  );
}
