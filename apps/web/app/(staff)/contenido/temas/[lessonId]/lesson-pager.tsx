'use client';

/**
 * El navegador entre temas del editor (24/9, Jhonny): dos flechas y «n de N».
 * SSOT: reference/03-ui/layout-y-componentes.md §5 (navegación no es acción).
 *
 * Recorre la RUTA del programa en el orden en que la estudia el estudiante —componente a
 * componente, tema a tema—, no solo el componente actual: quien revisa un programa entero
 * pasa de un tema al siguiente sin volver a la lista. Los vecinos los calcula
 * `readiness.service.ts` (`route`), con los archivados fuera.
 *
 * Son enlaces, no botones: se abren en otra pestaña con el botón central. Pero antes de
 * navegar en la misma pestaña, si hay cambios sin guardar, se guardan (`beforeNavigate`):
 * el autoguardado espera cinco segundos y cambiar de tema no puede costar los últimos.
 *
 * En un extremo la flecha sigue en su sitio, apagada, para que la otra no se mueva; lo que
 * dice el lector de pantalla es que no hay tema anterior/siguiente.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type MouseEvent } from 'react';
import { Tooltip } from '@/components/atoms/tooltip';
import { cn } from '@/lib/utils';
import type { LessonRouteNeighbors } from '@/features/content/server/readiness.service';

const ARROW =
  'rounded-control min-h-control min-w-control inline-flex items-center justify-center duration-fast ease-standard transition-colors';

export function LessonPager({
  route,
  beforeNavigate,
}: {
  route: LessonRouteNeighbors;
  /** Devuelve `false` si no se pudo dejar el tema en orden; entonces no se navega. */
  beforeNavigate: () => Promise<boolean>;
}) {
  const t = useTranslations('editor.pager');
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const go = (href: string) => async (event: MouseEvent<HTMLAnchorElement>) => {
    // Con modificador o botón central se abre aparte y este tema se queda como está.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (leaving) return;
    setLeaving(true);
    const ok = await beforeNavigate();
    setLeaving(false);
    if (ok) router.push(href);
  };

  const arrow = (
    neighbor: LessonRouteNeighbors['previous'],
    Icon: typeof ChevronLeft,
    key: 'previous' | 'next'
  ) => {
    if (!neighbor) {
      return (
        <span aria-disabled="true" className={cn(ARROW, 'text-text-subtle')}>
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">{t(`${key}None`)}</span>
        </span>
      );
    }
    const label = t(key, { title: neighbor.title });
    const href = `/contenido/temas/${neighbor.code}`;
    return (
      <Tooltip label={label}>
        <Link
          href={href}
          onClick={go(href)}
          aria-busy={leaving || undefined}
          className={cn(ARROW, 'text-text-muted hover:bg-surface-sunken hover:text-text')}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Link>
      </Tooltip>
    );
  };

  return (
    <nav aria-label={t('label')} className="flex items-center gap-1">
      {arrow(route.previous, ChevronLeft, 'previous')}
      <span className="type-caption text-text-muted tabular-nums">
        {t('position', { index: route.index, total: route.total })}
      </span>
      {arrow(route.next, ChevronRight, 'next')}
    </nav>
  );
}
