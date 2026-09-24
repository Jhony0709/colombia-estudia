'use client';

/**
 * El panel de «preparación» de una pieza de contenido (23/9, tercera pieza de la revisión
 * UX): una fila de comprobaciones arriba del editor que dice dónde está la pieza en la ruta,
 * qué le falta para salir y a quién le llegará al publicar.
 *
 * Es presentacional: cada editor decide sus comprobaciones (el tema mira sus vídeos y su
 * examen; el examen, sus preguntas) y este componente solo las pinta igual. El estado va en
 * icono **y** en palabras, nunca solo en color; lo que tiene remedio lleva su enlace.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { CircleAlert, CircleCheck, CircleDashed, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type ReadinessState = 'ok' | 'warn' | 'todo' | 'info';

export interface ReadinessCheck {
  key: string;
  state: ReadinessState;
  /** Lo que se comprueba («Vídeos», «Examen del tema»). */
  label: string;
  /** El resultado, en palabras («2 vídeos accesibles», «Ninguno todavía»). */
  detail: string;
  /** Adónde ir a arreglarlo o a verlo, si hay sitio. */
  href?: Route;
  linkLabel?: string;
}

const ICONS = {
  ok: CircleCheck,
  warn: CircleAlert,
  todo: CircleDashed,
  info: Info,
} as const;

const COLORS: Record<ReadinessState, string> = {
  ok: 'text-status-success-base',
  warn: 'text-status-warning-base',
  todo: 'text-text-subtle',
  info: 'text-status-info-base',
};

/** Cuántas comprobaciones piden algo (atención o pendiente): para el resumen plegado en móvil. */
export function pendingChecks(checks: ReadinessCheck[]): number {
  return checks.filter((check) => check.state === 'warn' || check.state === 'todo').length;
}

export function ReadinessPanel({
  checks,
  id,
  layout = 'grid',
}: {
  checks: ReadinessCheck[];
  id: string;
  /** `rail` (ola 2, 23/9): lista vertical para la columna derecha fija del editor. */
  layout?: 'grid' | 'rail';
}) {
  const t = useTranslations('readiness');

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-surface-sunken rounded-card space-y-3 px-5 py-4"
    >
      <h2 id={`${id}-title`} className="type-label text-text-muted">
        {t('title')}
      </h2>
      <ul
        className={
          layout === 'rail'
            ? 'flex flex-col gap-3'
            : 'grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3'
        }
      >
        {checks.map((check) => {
          const Icon = ICONS[check.state];
          return (
            <li key={check.key} className="flex items-start gap-2">
              <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', COLORS[check.state])} />
              <div className="min-w-0">
                <p className="type-body-emphasis text-text">{check.label}</p>
                <p
                  className={cn(
                    'type-caption',
                    check.state === 'todo' ? 'text-text-muted' : 'text-text'
                  )}
                >
                  <span className="sr-only">{t(`state.${check.state}`)}: </span>
                  {check.detail}
                  {check.href && check.linkLabel && (
                    <>
                      {' · '}
                      <Link
                        href={check.href}
                        className="text-accent-base underline-offset-2 hover:underline"
                      >
                        {check.linkLabel}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
