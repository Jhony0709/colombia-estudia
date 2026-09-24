'use client';

/**
 * La navegación interna de una ficha larga (ola 2 UX, 23/9): pestañas en escritorio, un
 * `<select>` en móvil. Cada pestaña es un enlace real (`href`), así que funciona sin
 * JavaScript, se comparte y vuelve con «atrás»; el `select` solo es la misma lista en
 * menos sitio, y sí necesita JavaScript para navegar.
 *
 * No son pestañas ARIA (`role="tab"`): cada destino es una URL con su propio contenido
 * servido, no un panel escondido en la misma página. `aria-current="page"` en la activa.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  href: Route;
  label: string;
  /** Un número al lado del rótulo: pendientes, novedades. */
  count?: number;
}

function isCurrent(item: SectionNavItem, pathname: string, search: string): boolean {
  const [path, query] = String(item.href).split('?');
  if (path !== pathname) return false;
  const wanted = new URLSearchParams(query ?? '');
  const actual = new URLSearchParams(search);
  for (const [key, value] of wanted) if (actual.get(key) !== value) return false;
  // Sin query propia, es la sección por defecto: activa solo si la URL tampoco lleva `seccion`.
  if (!query) return !actual.has('seccion');
  return true;
}

export function SectionNav({ label, items }: { label: string; items: SectionNavItem[] }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const router = useRouter();
  const current = items.find((item) => isCurrent(item, pathname, search)) ?? items[0];

  return (
    <nav aria-label={label} className="border-border-muted -mt-2 border-b">
      <ul className="hidden gap-1 sm:flex">
        {items.map((item) => {
          const active = item === current;
          return (
            <li key={String(item.href)}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'type-label min-h-touch -mb-px inline-flex items-center gap-2 border-b-2 px-3',
                  'duration-fast ease-standard transition-colors',
                  active
                    ? 'border-accent-base text-text'
                    : 'text-text-muted hover:text-text border-transparent'
                )}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 && (
                  <span className="bg-surface-sunken text-text rounded-pill type-caption px-2 tabular-nums">
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <label className="block pb-3 sm:hidden">
        <span className="sr-only">{label}</span>
        <select
          value={String(current?.href ?? '')}
          onChange={(event) => router.push(event.target.value as Route)}
          className="border-border bg-surface-base text-text type-body min-h-control rounded-control w-full border px-3"
        >
          {items.map((item) => (
            <option key={String(item.href)} value={String(item.href)}>
              {item.label}
              {item.count !== undefined && item.count > 0 ? ` (${item.count})` : ''}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
