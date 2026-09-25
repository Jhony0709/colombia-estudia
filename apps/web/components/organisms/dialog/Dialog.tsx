'use client';

/**
 * El diálogo modal de la plataforma: uno solo (25/9, Jhonny: «debe ser un único componente
 * dialog general»).
 * SSOT: reference/03-ui/layout-y-componentes.md §3 (Dialog).
 *
 * Hasta hoy había siete diálogos montados a mano sobre Radix, cada uno con su fondo, su
 * radio y su animación —y solo dos con el desenfoque y el motion que se decidieron el 23/9
 * para «Cerrar sesión». Aquí queda lo que todos comparten y ninguno tiene que recordar:
 *
 * - Radix `Dialog`: foco dentro al abrir, de vuelta al cerrar, Escape cierra, el tabulador
 *   no se escapa, `aria-labelledby`/`aria-describedby` puestos.
 * - Fondo oscurecido **y desenfocado** (`backdrop-blur-sm`): lo de detrás sigue ahí, pero no
 *   compite con la pregunta.
 * - Entra con grow y sale con fade (`.dialog-overlay` / `.dialog-panel` en `globals.css`,
 *   tokens de motion; corte seco con reduced-motion).
 * - Título arriba, descripción debajo, cuerpo libre y acciones a la derecha con la
 *   principal al final: la misma fila en todos, para que la mano sepa dónde está «Cancelar».
 *
 * `locked` impide cerrarlo (Escape, clic fuera) mientras hay una petición en vuelo: cerrar a
 * medias un envío deja al usuario sin saber si pasó. `scroll` es para cuerpos largos (la
 * accesibilidad de un vídeo): el panel se limita a la ventana y desplaza por dentro.
 *
 * No es `Sheet` (una hoja lateral para leer o rellenar sin perder la pantalla) ni el cajón
 * de navegación del teléfono: esos siguen siendo suyos.
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DialogSize = 'sm' | 'md' | 'lg';

const SIZE: Record<DialogSize, string> = {
  sm: 'max-w-[24rem]',
  md: 'max-w-lg',
  lg: 'max-w-xl',
};

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Lo que el lector de pantalla dice tras el título. Opcional: sin ella no se anuncia nada más. */
  description?: ReactNode;
  children?: ReactNode;
  /** La fila de botones, ya con sus `DialogClose` donde toque. */
  actions?: ReactNode;
  size?: DialogSize;
  /** Con `true` el diálogo no se cierra desde fuera (Escape, clic en el fondo). */
  locked?: boolean;
  /** Cuerpo largo: el panel se limita a la ventana y desplaza por dentro. */
  scroll?: boolean;
  /** `id` para la descripción, cuando otro control la referencia (`aria-describedby`). */
  descriptionId?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  size = 'md',
  locked = false,
  scroll = false,
  descriptionId,
}: DialogProps) {
  const hasDescription = description !== undefined && description !== null;
  // `Children.toArray` descarta `null`, `undefined` y booleanos: un cuerpo condicional que
  // hoy no toca no deja un hueco vacío con su margen.
  const hasBody = Children.toArray(children).length > 0;
  const hasActions = Children.toArray(actions).length > 0;

  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !locked && onOpenChange(next)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <RadixDialog.Content
          // Sin descripción, Radix avisa en consola si no se le dice explícitamente.
          {...(hasDescription ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'dialog-panel bg-surface-base elevation-modal rounded-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 p-6',
            SIZE[size],
            scroll && 'max-h-[calc(100%-2rem)] overflow-y-auto'
          )}
        >
          <RadixDialog.Title className="type-subheading text-text">{title}</RadixDialog.Title>
          {hasDescription && (
            <RadixDialog.Description
              id={descriptionId}
              className="type-body text-text-muted max-w-reading mt-2"
            >
              {description}
            </RadixDialog.Description>
          )}
          {hasBody && <div className="mt-4 space-y-4">{children}</div>}
          {hasActions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Envuelve un botón para que cierre el diálogo al pulsarlo (Radix `Close` con `asChild`). */
export function DialogClose({ children }: { children: ReactNode }) {
  return <RadixDialog.Close asChild>{children}</RadixDialog.Close>;
}
