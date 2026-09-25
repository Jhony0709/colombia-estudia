'use client';

/**
 * El diálogo pequeño del editor: un par de campos y dos botones, centrado.
 *
 * Enlace, imagen, fórmula, otro idioma y vídeo son la misma pieza con campos distintos: el
 * `Dialog` general (`organisms/dialog`, 25/9) con un `<form>` dentro para que Intro envíe.
 * El botón de enviar vive en la fila de acciones del diálogo, fuera del `<form>`, y lo
 * apunta con `form=`: así la fila es la misma que en todos los diálogos y Intro sigue
 * enviando. Los campos los pone quien lo abre.
 */

import { useId, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/atoms/button';
import { Dialog, DialogClose } from '@/components/organisms/dialog';

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
  const formId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      locked={busy}
      title={title}
      description={description}
      actions={
        <>
          <DialogClose>
            <Button type="button" variant="quiet" disabled={busy}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} loading={busy} disabled={disabled}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {children}
      </form>
    </Dialog>
  );
}
