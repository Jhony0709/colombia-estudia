/**
 * La ruta del programa al lado del contenido (21/9): dónde estoy, qué viene, qué falta.
 *
 * Traído de Coursera, donde el reproductor lleva la ruta del módulo a la izquierda y el
 * estudiante nunca tiene que «volver» para saber qué sigue. Server Component sin JavaScript:
 * los módulos son `<details>` —abierto el del ítem actual—, los ítems son enlaces o texto.
 *
 * En escritorio (`lg`) va en una columna lateral pegada arriba; en móvil, plegada bajo la
 * cabecera para no empujar el contenido dos pantallas hacia abajo.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  FileUp,
  Lock,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { OutlineItem, SequencedItem } from '@/features/learn/server/outline';
import type { OutlineModule } from '@/features/learn/server/cohort.service';
import { cn } from '@/lib/utils';
import { RouteRailFrame } from './route-rail-frame';

/** Icono por forma del ítem: lo que Coursera pone delante de cada uno. */
export const FORM_ICONS: Record<NonNullable<OutlineItem['form']>, LucideIcon> = {
  VIDEO: Video,
  MARKDOWN: BookOpen,
  SUBMISSION: FileUp,
  ASSESSMENT: ClipboardCheck,
};

export const formOf = (item: Pick<SequencedItem, 'form' | 'kind'>) =>
  item.form ?? (item.kind === 'ASSESSMENT' ? 'ASSESSMENT' : 'MARKDOWN');

export const hrefFor = (item: Pick<SequencedItem, 'kind' | 'assignmentId'>) =>
  item.kind === 'LESSON'
    ? `/aprender/tema/${item.assignmentId}`
    : `/aprender/examen/${item.assignmentId}`;

/** «Vídeo · 12 min», o solo «Lectura» si no hay minutos. */
export const itemMeta = (
  item: Pick<SequencedItem, 'form' | 'kind' | 'estimatedMinutes'>,
  t: Awaited<ReturnType<typeof getTranslations>>
) =>
  [
    t(`form.${formOf(item)}`),
    item.estimatedMinutes ? t('minutes', { count: item.estimatedMinutes }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

export async function RouteRail({
  modules,
  currentId,
  enrollmentId,
}: {
  modules: OutlineModule[];
  currentId: string;
  enrollmentId: string;
}) {
  const t = await getTranslations('learn');

  return (
    <nav aria-label={t('rail.label')} className="space-y-2">
      <Link
        href={`/aprender?matricula=${enrollmentId}#ruta`}
        className="type-caption text-text-link min-h-touch inline-flex items-center underline"
      >
        {t('rail.allRoute')}
      </Link>
      {modules.map((module) => {
        const holdsCurrent = module.items.some((item) => item.assignmentId === currentId);
        const completed = module.items.filter((item) => item.status === 'COMPLETED').length;
        const locked = module.items.length > 0 && module.items.every((item) => !item.enabled);

        return (
          <details
            key={module.id}
            open={holdsCurrent}
            className="border-border rounded-control border"
          >
            <summary className="min-h-touch flex cursor-pointer items-center gap-2 px-3 py-2">
              {locked && <Lock aria-hidden className="text-text-muted size-4 shrink-0" />}
              <span className="type-body-emphasis text-text min-w-0 flex-1 truncate">
                {module.name}
              </span>
              <span className="type-caption text-text-muted shrink-0">
                {completed}/{module.items.length}
              </span>
            </summary>
            <ul className="border-border-muted divide-border-muted divide-y border-t">
              {module.items.map((item) => (
                <li key={item.assignmentId}>
                  <RailItem item={item} current={item.assignmentId === currentId} />
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

async function RailItem({ item, current }: { item: SequencedItem; current: boolean }) {
  const t = await getTranslations('learn');
  const Icon = item.status === 'COMPLETED' ? CircleCheck : FORM_ICONS[formOf(item)];
  const iconClass = cn(
    'mt-0.5 size-4 shrink-0',
    item.status === 'COMPLETED' ? 'text-status-success-base' : 'text-text-muted'
  );
  const body = (
    <>
      <Icon aria-hidden className={iconClass} />
      <span className="min-w-0 flex-1">
        <span className={cn('type-body block', current && 'type-body-emphasis')}>{item.title}</span>
        <span className="type-caption text-text-muted block">{itemMeta(item, t)}</span>
      </span>
    </>
  );

  if (current) {
    return (
      <div
        aria-current="page"
        className="bg-surface-sunken border-accent-base flex items-start gap-2 border-l-4 px-3 py-2"
      >
        {body}
      </div>
    );
  }

  if (!item.enabled) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 pl-4">
        <Lock aria-hidden className="text-text-muted mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="type-body text-text-muted block">{item.title}</span>
          <span className="type-caption text-text-muted block">{itemMeta(item, t)}</span>
        </span>
      </div>
    );
  }

  return (
    <Link
      href={hrefFor(item)}
      className="hover:bg-surface-sunken flex items-start gap-2 px-3 py-2 pl-4"
    >
      {body}
    </Link>
  );
}

/**
 * El contenido con la ruta al lado: columna lateral en escritorio, plegable en móvil.
 * `children` es el contenido del tema o del examen; `rail` la `RouteRail`.
 */
export async function WithRouteRail({
  rail,
  children,
}: {
  rail: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations('learn');
  return (
    <>
      {/* Móvil: la ruta plegada bajo la cabecera; el marco de escritorio no la pinta. */}
      <details className="border-border rounded-card mb-6 border p-3 lg:hidden">
        <summary className="type-body-emphasis min-h-touch flex cursor-pointer items-center">
          {t('rail.toggle')}
        </summary>
        <div className="mt-3">{rail}</div>
      </details>
      {/* Escritorio (E2, 23/9): 15 rem y plegable, con la preferencia en el navegador. */}
      <RouteRailFrame rail={rail} hideLabel={t('rail.hide')} showLabel={t('rail.show')}>
        {children}
      </RouteRailFrame>
    </>
  );
}
