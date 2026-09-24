'use client';

/**
 * «Publicado por X el …»: la auditoría que importa, donde se lee (ola 2, 23/9;
 * `docs/ux/decision-ux-2309.md`). Va junto a la píldora de versión en los dos editores. Si la
 * versión publicada no tiene actor (persona retirada, importación) se dice solo la fecha.
 */

import { useFormatter, useTranslations } from 'next-intl';
import type { PublishedVersion } from '@/features/content/server/readiness.service';

export function PublishedLine({ published }: { published: PublishedVersion | null }) {
  const t = useTranslations('readiness');
  const format = useFormatter();

  if (!published || !published.at) return null;

  const date = format.dateTime(new Date(published.at), { dateStyle: 'medium' });

  return (
    <p className="type-caption text-text-muted">
      {published.by
        ? t('publishedBy', { number: published.number, name: published.by, date })
        : t('publishedAt', { number: published.number, date })}
    </p>
  );
}
