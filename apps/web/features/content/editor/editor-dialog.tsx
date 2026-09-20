'use client';

/**
 * El diálogo pequeño del editor: un par de campos y dos botones, centrado.
 *
 * Enlace, imagen, fórmula, otro idioma y vídeo son la misma pieza con campos distintos: un
 * `Dialog` de Radix —foco dentro, Escape cierra, el tabulador no se escapa— con un `<form>`
 * dentro para que Intro envíe. Los campos los pone quien lo abre.
 */

import * as Dialog from '@radix-ui/react-dialog';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/atoms/button';

export interface EditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  cancelLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
}

export function EditorDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel,
  busy = false,
  disabled = false,
  onSubmit,
  children,
}: EditorDialogProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="bg-surface-base elevation-modal rounded-sheet fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 p-6">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-1">
              <Dialog.Title className="type-subheading text-text">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="type-caption text-text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>

            {children}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={busy} disabled={disabled}>
                {submitLabel}
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="quiet" disabled={busy}>
                  {cancelLabel}
                </Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
