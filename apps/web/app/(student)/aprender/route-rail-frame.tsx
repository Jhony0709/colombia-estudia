'use client';

/**
 * El marco del player en escritorio (E2, 23/9): la ruta en una columna de 15 rem a la
 * izquierda, **plegable**. Un vídeo o un texto ancho merece el sitio; quien ya sabe dónde
 * está pliega la ruta y la vuelve a abrir cuando quiera. La preferencia se guarda en el
 * navegador (`ce.rail.collapsed`), como las de lectura.
 *
 * Cliente por el estado del pliegue; `rail` y `children` llegan ya pintados del servidor.
 * En móvil no interviene: la ruta va en un `<details>` (`WithRouteRail`).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEY = 'ce.rail.collapsed';

export function RouteRailFrame({
  rail,
  children,
  hideLabel,
  showLabel,
}: {
  rail: ReactNode;
  children: ReactNode;
  hideLabel: string;
  showLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(KEY) === '1');
    } catch {
      // Sin almacenamiento: abierta, que es lo seguro.
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // Ídem.
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        'lg:grid lg:items-start lg:gap-8',
        collapsed ? 'lg:grid-cols-[auto_minmax(0,1fr)]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]'
      )}
    >
      <aside
        className={cn(
          'sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto lg:block',
          collapsed && 'w-auto'
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch mb-2 inline-flex items-center gap-2 px-2"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden className="size-5" />
          )}
          <span className={cn('type-caption', collapsed && 'sr-only')}>
            {collapsed ? showLabel : hideLabel}
          </span>
        </button>
        {!collapsed && rail}
      </aside>
      <div className="min-w-0 space-y-10">{children}</div>
    </div>
  );
}
