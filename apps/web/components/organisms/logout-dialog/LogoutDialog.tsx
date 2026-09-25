'use client';

/**
 * «Cerrar sesión» pregunta antes de hacerlo (23/9, pedido de Jhonny): un diálogo en el
 * sitio, no un viaje a `/auth/logout`. La página sigue existiendo para quien llegue por URL,
 * pero desde la navegación ya no se sale de donde se estaba para confirmar.
 *
 * Es `Dialog` (`organisms/dialog`, el diálogo único desde el 25/9): foco dentro al abrir,
 * de vuelta al cerrar, Escape cierra, fondo oscurecido y desenfocado, grow al entrar y fade
 * al salir. Aquí solo va lo suyo: la pregunta y el `<form>`.
 *
 * El cierre es un `<form method="POST">`, como en `/auth/logout`: nada se cierra por GET.
 * Textos en español directo, como el resto de la navegación (`SideNav`, `StudentTopNav`).
 */

import { useState, type ReactNode } from 'react';
import { Dialog, DialogClose } from '@/components/organisms/dialog';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { cn } from '@/lib/utils';

export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      locked={submitting}
      size="sm"
      title="¿Cerrar sesión?"
      description="Para volver a entrar tendrás que iniciar sesión otra vez."
    >
      <form
        action="/api/auth/logout"
        method="POST"
        onSubmit={() => setSubmitting(true)}
        className="flex flex-wrap justify-end gap-2"
      >
        <DialogClose>
          <Button type="button" variant="secondary" disabled={submitting}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" loading={submitting}>
          Cerrar sesión
        </Button>
      </form>
    </Dialog>
  );
}

/**
 * El botón que abre el diálogo, con su diálogo. Es un `<button>`, no un enlace: ya no lleva
 * a ningún sitio (la regla de `NavItem`: navegar y actuar no comparten componente).
 * `className` decide el aspecto según dónde va: fila de navegación, cabecera, menú.
 */
export function LogoutButton({
  className,
  children = 'Cerrar sesión',
  icon = true,
}: {
  className?: string;
  children?: ReactNode;
  /** Icono decorativo a la izquierda. */
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(className)}>
        {icon && <LogOut className="size-[18px]" aria-hidden="true" />}
        <span>{children}</span>
      </button>
      <LogoutDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
