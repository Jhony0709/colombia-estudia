'use client';

/**
 * Los medios del tema, con lo que les falta para poder publicar.
 * SSOT: packages/domain/src/publish-validation.ts:270-282, revisión de UX del 18/9.
 *
 * Esta pantalla faltaba. Un video registrado sin subtítulos comprobables —lo que pasa siempre
 * cuando no hay `VIMEO_ACCESS_TOKEN` y se registra por oEmbed— quedaba impublicable sin
 * remedio: el único escritor de `captionsSource` y `transcriptPath` era el formulario de
 * añadir un video, que además insertaba la directiva otra vez.
 *
 * Enseña la dirección de Vimeo de cada video. No es un dato nuevo: `render-assets.ts:27`
 * construye esa misma dirección para reproducirlo en la vista previa. La pantalla sabía
 * perfectamente qué video era; simplemente no lo decía.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import * as Dialog from '@radix-ui/react-dialog';
import { apiErrorText } from '@/lib/http/api-error-text';

export interface MediaItem {
  mediaAssetId: string;
  kind: string;
  provider: string;
  providerRef: string;
  durationSeconds: number | null;
  captionsSource: string;
  hasTranscript: boolean;
  missingCaptions: boolean;
}

/**
 * Los medios del tema, cargados una vez y compartidos: el editor los enseña dentro de cada
 * bloque de vídeo y el diálogo de accesibilidad edita uno. Una sola carga, una sola verdad.
 */
export function useLessonMedia(lessonId: string, versionId: string) {
  const t = useTranslations('editor');
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/lessons/${lessonId}/media?versionId=${versionId}`);
      if (!res.ok) {
        setError(t('mediaLoadError'));
        return;
      }
      const payload = (await res.json()) as { data?: { items?: MediaItem[] } };
      setItems(payload.data?.items ?? []);
      setError(null);
    } catch {
      setError(t('mediaLoadError'));
    }
  }, [lessonId, t, versionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, error, reload };
}

/**
 * La accesibilidad de un medio —transcripción, subtítulos revisados— en un diálogo que se
 * abre desde el engranaje del bloque de vídeo. Hasta el 19/9 era una tarjeta aparte, «Videos
 * y audios de este tema», con todos los medios listados debajo del texto: la persona miraba
 * el vídeo en un sitio y arreglaba sus subtítulos en otro.
 */
export function MediaSettingsDialog({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: MediaItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('editor');
  const [transcript, setTranscript] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item === null) return null;

  const needs = item.kind === 'VIDEO' || item.kind === 'AUDIO';
  const vimeo = item.provider === 'VIMEO' ? `https://vimeo.com/${item.providerRef}` : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${item.mediaAssetId}/accessibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(transcript.trim() === '' ? {} : { transcript }),
          ...(reviewed ? { captionsReviewed: true } : {}),
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as unknown;
        setError(apiErrorText(payload, t('mediaSaveError')));
        return;
      }

      setTranscript('');
      setReviewed(false);
      onSaved();
      onClose();
    } catch {
      setError(t('mediaSaveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="bg-surface-base elevation-modal rounded-sheet fixed left-1/2 top-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 space-y-3 overflow-y-auto p-6">
          <Dialog.Title className="type-subheading text-text">
            {t('mediaSettingsTitle', { kind: t(`mediaKind.${item.kind}`) })}
          </Dialog.Title>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {vimeo !== null && (
              <a
                href={vimeo}
                target="_blank"
                rel="noreferrer"
                className="type-caption text-text-link underline"
              >
                {`vimeo.com/${item.providerRef}`}
              </a>
            )}
            {item.durationSeconds !== null && (
              <span className="type-caption text-text-muted">
                {t('mediaMinutes', { minutes: Math.max(1, Math.round(item.durationSeconds / 60)) })}
              </span>
            )}
          </div>

          <Dialog.Description className="type-caption text-text-muted max-w-reading">
            {item.captionsSource === 'REVIEWED'
              ? t('mediaOkReviewed')
              : item.hasTranscript
                ? t('mediaOkTranscript')
                : item.missingCaptions
                  ? t('mediaBlocked')
                  : t('mediaNothingNeeded')}
          </Dialog.Description>

          {needs && item.missingCaptions && (
            <>
              {error !== null && <Alert severity="error">{error}</Alert>}

              <div>
                <label
                  htmlFor={`transcript-${item.mediaAssetId}`}
                  className="type-label text-text block"
                >
                  {t('videoTranscript')}
                </label>
                <p className="type-caption text-text-muted max-w-reading">
                  {t('videoTranscriptHint')}
                </p>
                <textarea
                  id={`transcript-${item.mediaAssetId}`}
                  rows={5}
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  className="border-border bg-surface-base text-text type-body rounded-control mt-1 w-full border p-3"
                />
              </div>

              {/* La casilla es la ÚNICA vía a `REVIEWED`, y por eso está redactada como una
              afirmación de quien la marca y no como un ajuste: la API de Vimeo no distingue
              unos subtítulos automáticos de unos escritos a mano, y por oEmbed ni se ven. */}
              {item.kind === 'VIDEO' && (
                <div className="min-h-touch flex items-start gap-3 py-1">
                  <input
                    id={`reviewed-${item.mediaAssetId}`}
                    type="checkbox"
                    checked={reviewed}
                    onChange={(event) => setReviewed(event.target.checked)}
                    className="border-border text-accent-base focus:ring-accent-base mt-0.5 h-6 w-6 shrink-0 rounded"
                  />
                  <label
                    htmlFor={`reviewed-${item.mediaAssetId}`}
                    className="type-body text-text max-w-reading cursor-pointer"
                  >
                    {t('videoReviewed')}
                    <span className="type-caption text-text-muted block">
                      {t('videoReviewedHint')}
                    </span>
                  </label>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  loading={busy}
                  disabled={transcript.trim() === '' && !reviewed}
                  onClick={() => void save()}
                >
                  {t('mediaSave')}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="quiet" disabled={busy}>
                    {t('cancel')}
                  </Button>
                </Dialog.Close>
              </div>
            </>
          )}
          {!(needs && item.missingCaptions) && (
            <Dialog.Close asChild>
              <Button type="button" variant="secondary">
                {t('cancel')}
              </Button>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
