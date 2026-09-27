'use client';

/**
 * Editar un componente (25/9): nombre, grado, descripción y texto de cierre.
 *
 * Era un formulario en línea dentro de la celda del nombre; con dos textareas la fila crecía
 * hasta romper la tabla (Jhonny, 25/9: «la edición de componente debe ser un diálogo»). Ahora
 * es el `Dialog` general (`organisms/dialog`) con el mismo patrón que `EditorDialog`: el
 * `<form>` va en el cuerpo y el botón de guardar en la fila de acciones, enlazado por `form=`.
 */

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FormField, FormInput, FormTextarea } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Dialog, DialogClose } from '@/components/organisms/dialog';
import type { CurriculumModule } from '@/features/admin/server/curriculum.service';
import type { Send } from '../curriculum-send';
import { CoverImageField, type CoverValue } from './cover-image-field';

export function EditModuleDialog({
  module,
  busy,
  send,
  onClose,
}: {
  module: CurriculumModule;
  busy: boolean;
  send: Send;
  onClose: () => void;
}) {
  const t = useTranslations('admin.curriculum');
  const formId = useId();
  const [name, setName] = useState(module.name);
  const [grade, setGrade] = useState(module.grade === null ? '' : String(module.grade));
  const [description, setDescription] = useState(module.description ?? '');
  const [closingText, setClosingText] = useState(module.closingText ?? '');
  const [cover, setCover] = useState<CoverValue>({
    mediaAssetId: module.coverMediaId,
    previewUrl: module.coverUrl,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await send(
      `/api/admin/modules/${module.id}`,
      'PATCH',
      {
        op: 'update',
        name,
        grade: grade.trim() === '' ? null : Number(grade),
        description,
        closingText,
        coverMediaId: cover.mediaAssetId,
      },
      t('moduleUpdated')
    );
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      locked={busy}
      size="lg"
      scroll
      title={t('moduleEditTitle', { code: module.code })}
      actions={
        <>
          <DialogClose>
            <Button type="button" variant="quiet" disabled={busy}>
              {t('cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} loading={busy} disabled={name.trim() === ''}>
            {t('save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <FormField label={t('moduleName')} name="module-name" required>
              <FormInput
                name="module-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
          </div>
          <div className="w-28">
            <FormField label={t('moduleGrade')} name="module-grade">
              <FormInput
                name="module-grade"
                type="number"
                inputMode="numeric"
                min={0}
                max={13}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </FormField>
          </div>
        </div>
        {/* De qué va y cómo se cierra: lo lee el estudiante en su ruta y al enviar el
            cuestionario del componente. */}
        <FormField
          label={t('moduleDescription')}
          name="module-description"
          hint={t('moduleDescriptionHint')}
        >
          <FormTextarea
            name="module-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>
        {/* La imagen de la tarjeta del curso (25/9): lo que ve el estudiante en «Cursos abiertos». */}
        <CoverImageField value={cover} onChange={setCover} disabled={busy} />
        <FormField label={t('moduleClosing')} name="module-closing" hint={t('moduleClosingHint')}>
          <FormTextarea
            name="module-closing"
            rows={6}
            value={closingText}
            onChange={(e) => setClosingText(e.target.value)}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
