'use client';

/**
 * Eliminar un tema (24/9, Jhonny: «permite eliminar los temas, con validación extra»).
 *
 * Archivar sigue siendo lo normal; eliminar es para el tema que se creó por error o a medias
 * y nadie ha visto. El servidor solo lo permite sin cohortes que lo tengan asignado y sin
 * examen del tema; aquí se dice antes de intentarlo (`usage`) para que el botón explique por
 * qué no, en vez de fallar. La validación extra: escribir el título exacto, como en los
 * borrados irreversibles de GitHub. Mismo diálogo de Radix que «Cerrar sesión», con su
 * motion (`.dialog-overlay` / `.dialog-panel`).
 */

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { apiErrorText } from '@/lib/http/api-error-text';

export function DeleteLessonDialog({
  lessonId,
  title,
  usage,
}: {
  lessonId: string;
  title: string;
  usage: { assignments: number; assessments: number; versions: number };
}) {
  const t = useTranslations('editor.delete');
  const router = useRouter();
  const ids = { desc: useId() };
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blockedBy = usage.assignments > 0 ? 'assigned' : usage.assessments > 0 ? 'hasExam' : null;
  const matches = typed.trim() === title.trim();

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTitle: typed.trim() }),
      });
      if (!res.ok) {
        setError(apiErrorText(await res.json().catch(() => null), t('error')));
        return;
      }
      router.push('/contenido/temas');
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  if (blockedBy) {
    // No hay botón que no haga nada: se dice por qué solo se puede archivar.
    return (
      <p className="type-caption text-text-muted max-w-reading">{t(`blocked.${blockedBy}`)}</p>
    );
  }

  return (
    <>
      <Button type="button" variant="quiet" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
      <Dialog.Root open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={ids.desc}
            className="dialog-panel bg-surface-base elevation-modal rounded-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 p-6"
          >
            <Dialog.Title className="type-subheading text-text">
              {t('title', { title })}
            </Dialog.Title>
            <Dialog.Description id={ids.desc} className="type-body text-text-muted mt-2">
              {t('body', { versions: usage.versions })}
            </Dialog.Description>

            <form
              className="mt-4 space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (matches) void remove();
              }}
            >
              <FormField label={t('confirmLabel', { title })} name="confirmTitle" required>
                <FormInput
                  name="confirmTitle"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </FormField>
              {error !== null && <Alert severity="error">{error}</Alert>}
              <div className="flex flex-wrap justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary" disabled={busy}>
                    {t('cancel')}
                  </Button>
                </Dialog.Close>
                <Button type="submit" loading={busy} disabled={!matches}>
                  {t('confirm')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
