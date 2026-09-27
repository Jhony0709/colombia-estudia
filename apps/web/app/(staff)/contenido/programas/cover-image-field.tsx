'use client';

/**
 * La imagen de la tarjeta del curso (26/9), dentro de `EditModuleDialog`.
 *
 * La subida es `useImageUpload` (27/9), la misma que usa el editor de temas: validar,
 * reescalar, pedir sitio, subir directo a Storage y `confirm`. Aquí solo se guarda el
 * `mediaAssetId` que sale de eso; el componente se actualiza al guardar el diálogo, no al
 * elegir el archivo.
 *
 * Decorativa: la tarjeta lleva el nombre del curso al lado, así que no se pide texto
 * alternativo y el `<img>` va con `alt=""` (WCAG 1.1.1, contenido decorativo).
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { IMAGE_ACCEPT, IMAGE_MAX_MB, useImageUpload } from '@/lib/media/use-image-upload';

export interface CoverValue {
  mediaAssetId: string | null;
  /** Lo que se enseña: la URL firmada del servidor o la vista previa local del archivo nuevo. */
  previewUrl: string | null;
}

export function CoverImageField({
  value,
  onChange,
  disabled = false,
}: {
  value: CoverValue;
  onChange: (next: CoverValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.curriculum.cover');
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy } = useImageUpload();
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  // La vista previa local es un `blob:` que hay que soltar cuando deja de usarse.
  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);

  const pick = async (file: File) => {
    setError(null);
    const outcome = await upload(file);
    if (input.current) input.current.value = '';
    if (!outcome.ok) {
      setError(
        outcome.error === 'type'
          ? t('errors.type')
          : outcome.error === 'size'
            ? t('errors.size', { mb: IMAGE_MAX_MB })
            : (outcome.message ?? t('errors.upload'))
      );
      return;
    }
    setLocalUrl(outcome.result.previewUrl);
    onChange({ mediaAssetId: outcome.result.mediaAssetId, previewUrl: outcome.result.previewUrl });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{t('label')}</Label>
      {value.previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage o blob local.
        <img
          src={value.previewUrl}
          alt=""
          className="bg-surface-muted rounded-card aspect-[16/9] w-full max-w-sm object-cover"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={IMAGE_ACCEPT}
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
          }}
          className="type-body text-text block max-w-full"
          aria-describedby={`${inputId}-hint`}
        />
        {value.mediaAssetId && (
          <Button
            type="button"
            variant="quiet"
            disabled={disabled || busy}
            onClick={() => onChange({ mediaAssetId: null, previewUrl: null })}
          >
            {t('remove')}
          </Button>
        )}
      </div>
      <p id={`${inputId}-hint`} className="type-caption text-text-muted m-0">
        {busy ? t('uploading') : t('hint', { mb: IMAGE_MAX_MB })}
      </p>
      {error && (
        <p role="alert" className="type-caption text-status-error-base m-0">
          {error}
        </p>
      )}
    </div>
  );
}
