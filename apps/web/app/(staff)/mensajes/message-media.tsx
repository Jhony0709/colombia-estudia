/**
 * El archivo de un mensaje del chat (27/11): audio con reproductor, foto, video o documento
 * para descargar. La URL viene firmada del servidor y caduca a los 10 minutos.
 */

import { getTranslations } from 'next-intl/server';
import { FileText } from 'lucide-react';

export async function MessageMedia({
  media,
}: {
  media: { type: string; name: string | null; url: string };
}) {
  const t = await getTranslations('messaging.thread.media');

  if (media.type === 'audio') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- Nota de voz del chat: no trae subtítulos.
      <audio controls preload="none" src={media.url} className="w-64 max-w-full">
        <a href={media.url}>{t('audio')}</a>
      </audio>
    );
  }
  if (media.type === 'image' || media.type === 'sticker') {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage. */}
        <img src={media.url} alt={t('image')} className="rounded-control max-h-64 max-w-full" />
      </a>
    );
  }
  if (media.type === 'video') {
    // eslint-disable-next-line jsx-a11y/media-has-caption -- Video del chat: no trae subtítulos.
    return <video controls preload="metadata" src={media.url} className="max-h-64 max-w-full" />;
  }
  return (
    <a
      href={media.url}
      className="type-body text-text-link min-h-touch inline-flex items-center gap-2 underline underline-offset-4"
    >
      <FileText aria-hidden className="size-4 shrink-0" />
      {media.name ?? t('document')}
    </a>
  );
}
