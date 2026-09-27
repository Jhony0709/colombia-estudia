'use client';

/**
 * La barra inferior de pestañas del estudiante en el teléfono (27/9, del diseño aprobado):
 * Mis programas, Calendario, Biblioteca y Mi cuenta al alcance del pulgar. Sustituye al
 * segundo renglón de la barra superior, que bajo `md` hacía scroll horizontal.
 *
 * Solo bajo `lg`; en modo tarea (`<html class="task-mode">`, el player y el intento) se
 * oculta por CSS: ahí el pie ya lo ocupa la barra de «Siguiente» y dos barras abajo son una
 * de más. `<main>` lleva `pb` bajo `lg` para que el final de cada pantalla no quede debajo.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, Library, UserRound, type LucideIcon } from 'lucide-react';
import type { NavDestination } from '@/lib/nav/staff-nav';
import { isActive } from '@/lib/nav/is-active';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  '/aprender': BookOpen,
  '/aprender/calendario': CalendarDays,
  '/aprender/biblioteca': Library,
  '/aprender/mi-cuenta': UserRound,
};

export function StudentTabBar({ items }: { items: NavDestination[] }) {
  const currentPath = usePathname() as string | null;
  const tabs = items.filter((item) => item.href in ICONS);
  if (tabs.length === 0) return null;

  return (
    <nav
      data-student-tabbar
      aria-label="Principal"
      className="bg-surface-base border-border-muted fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="m-0 flex list-none p-0">
        {tabs.map((item) => {
          const Icon = ICONS[item.href]!;
          const active = isActive(currentPath, item);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'min-h-touch flex flex-col items-center justify-center gap-0.5 px-1 py-2',
                  active ? 'text-accent-base' : 'text-text-muted hover:text-text'
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className="type-caption truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
