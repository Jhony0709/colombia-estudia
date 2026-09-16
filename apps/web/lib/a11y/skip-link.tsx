/**
 * Skip link for keyboard navigation.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Hidden until focused; jumps to #contenido.
 */

import React from 'react';
import { useTranslations } from 'next-intl';

export function SkipLink() {
  const t = useTranslations('a11y');

  return (
    <a
      href="#contenido"
      className="focus:bg-surface-raised focus:rounded-control focus:text-text sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2"
    >
      {t('skipToContent')}
    </a>
  );
}
