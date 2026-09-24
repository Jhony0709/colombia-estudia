'use client';

/**
 * «Cerrar sesión» pregunta antes de hacerlo (23/9, pedido de Jhonny): un diálogo en el
 * sitio, no un viaje a `/auth/logout`. La página sigue existiendo para quien llegue por URL,
 * pero desde la navegación ya no se sale de donde se estaba para confirmar.
 *
 * Es la misma pieza de Radix que `Sheet` y que la confirmación del examen: foco dentro al
 * abrir, foco de vuelta al cerrar, Escape cierra, el tabulador no se escapa. El fondo va
 * oscurecido **y desenfocado** (`backdrop-blur-sm`): lo de detrás sigue ahí, se ve que está,
 * pero no compite con la pregunta. Entra con grow y sale con fade (`.dialog-overlay` /
 * `.dialog-panel` en `globals.css`, tokens de motion; corte seco con reduced-motion).
 *
 * El cierre es un `<form method="POST">`, como en `/auth/logout`: nada se cierra por GET.
 * Textos en español directo, como el resto de la navegación (`SideNav`, `StudentTopNav`).
 */

import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
    <Dialog.Root open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="dialog-panel bg-surface-base elevation-modal rounded-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[24rem] -translate-x-1/2 -translate-y-1/2 p-6">
          <Dialog.Title className="type-subheading text-text">¿Cerrar sesión?</Dialog.Title>
          <Dialog.Description className="type-body text-text-muted mt-2">
            Para volver a entrar tendrás que iniciar sesión otra vez.
          </Dialog.Description>
          <form
            action="/api/auth/logout"
            method="POST"
            onSubmit={() => setSubmitting(true)}
            className="mt-5 flex flex-wrap justify-end gap-2"
          >
            <Dialog.Close asChild>
              <Button type="button" variant="secondary" disabled={submitting}>
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="submit" loading={submitting}>
              Cerrar sesión
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
