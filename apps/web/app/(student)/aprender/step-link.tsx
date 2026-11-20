/**
 * El enlace a un paso vecino de la ruta (anterior o siguiente), compartido por el tema y el
 * examen. Bloqueado, dice qué falta en vez de llevar a ninguna parte.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import type { StepNeighbour } from '@/features/learn/server/outline';

export async function StepLink({
  item,
  direction,
  currentTitle,
}: {
  item: StepNeighbour;
  direction: 'previous' | 'next';
  /** Para decir «completa este tema» en vez de repetir su propio título. */
  currentTitle?: string;
}) {
  const t = await getTranslations('learn');

  const href =
    item.kind === 'LESSON'
      ? `/aprender/tema/${item.assignmentId}`
      : `/aprender/examen/${item.assignmentId}`;

  if (!item.enabled) {
    const reason =
      item.blockedBy === currentTitle
        ? t('lesson.completeToContinue', { title: item.title })
        : item.blockedBy
          ? t('blockedBy', { title: item.blockedBy })
          : item.locked
            ? t('lesson.nextLocked')
            : t('notYet');
    return (
      <span className="type-caption text-text-muted inline-flex items-center gap-1.5 text-left sm:max-w-[20rem] sm:text-right">
        {/* En el teléfono (4/10) la barra ya dice el estado arriba; aquí basta el candado y
            «Siguiente»: la frase entera eran dos líneas más bajo el pulgar. */}
        <Lock aria-hidden className="size-4 shrink-0 sm:hidden" />
        <span className="sm:hidden" aria-hidden="true">
          {t('lesson.nextShortLocked')}
        </span>
        <span className="sr-only sm:not-sr-only">{reason}</span>
      </span>
    );
  }

  if (direction === 'next') {
    return (
      <Button asChild>
        <Link href={href}>
          {/* En el teléfono cabe «Siguiente» y poco más; el título completo va en el nombre
              accesible. Desde `sm`, el título truncado a lo que quepa. */}
          <span className="sr-only sm:not-sr-only sm:max-w-[16rem] sm:truncate lg:max-w-[18rem] xl:max-w-[24rem]">
            {item.kind === 'ASSESSMENT'
              ? t('lesson.nextExam', { title: item.title })
              : t('lesson.next', { title: item.title })}
          </span>
          <span aria-hidden className="sm:hidden">
            {t('lesson.nextShort')}
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      </Button>
    );
  }

  return (
    <Link
      href={href}
      className="text-text-link type-caption min-h-touch inline-flex min-w-0 items-center gap-1 underline"
    >
      <ArrowLeft aria-hidden className="size-4 shrink-0" />
      <span className="sr-only sm:not-sr-only sm:max-w-[12rem] sm:truncate">
        {t('lesson.previous', { title: item.title })}
      </span>
      <span aria-hidden className="sm:hidden">
        {t('lesson.previousShort')}
      </span>
    </Link>
  );
}
