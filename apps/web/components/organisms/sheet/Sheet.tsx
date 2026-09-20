'use client';

/**
 * Sheet: una hoja que entra por la derecha y se apodera de la pantalla.
 * SSOT: reference/03-ui/layout-y-componentes.md §3 (`elevation-modal`: «diálogo y hoja»).
 *
 * Es la misma pieza de Radix que el cajón de la navegación en móvil (`SideNav`), con la
 * orientación contraria: aquella trae el menú desde la izquierda, esta trae CONTENIDO —una
 * vista previa, la ayuda de la pantalla— desde la derecha, sin salir de donde se estaba.
 * Radix pone el foco dentro al abrir, lo devuelve al cerrar, cierra con Escape y no deja que
 * el tabulador se salga: todo lo que WCAG 2.4.3 y 2.1.2 piden de un diálogo, sin escribirlo.
 *
 * En teléfono ocupa el ancho entero: una hoja de 40rem sobre una pantalla de 24 no es una
 * hoja, es la pantalla con un borde.
 */

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Una línea bajo el título. Va en `Dialog.Description`, que es lo que el lector anuncia. */
  description?: string;
  children: ReactNode;
  /** Ancha para contenido que se lee (una vista previa); estrecha para listas y ayudas. */
  size?: 'reading' | 'narrow';
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'narrow',
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={cn(
            'bg-surface-base elevation-modal fixed inset-y-0 right-0 z-50 flex w-full flex-col',
            size === 'reading' ? 'sm:max-w-[48rem]' : 'sm:max-w-[28rem]'
          )}
        >
          <div className="border-border-muted flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="min-w-0 space-y-1">
              <Dialog.Title className="type-subheading text-text">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="type-caption text-text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {/*
              Sin tooltip (19/9): el cierre es lo primero que enfoca Radix al abrir la hoja, y
              un tooltip que se abre con el foco aparecería solo y se comería el primer Escape,
              porque su capa queda por encima de la del diálogo. La X con nombre `sr-only` basta.
            */}
            <Dialog.Close className="text-text min-h-touch min-w-touch rounded-control hover:bg-surface-sunken flex shrink-0 items-center justify-center">
              <X aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
