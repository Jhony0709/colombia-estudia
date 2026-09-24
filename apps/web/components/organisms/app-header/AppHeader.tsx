/**
 * AppHeader organism: **RETIRADO el 18/9**, reemplazado por `organisms/side-nav`.
 *
 * No se borra (`DESIGN.md` §Reglas de proceso) y no se usa en pantallas nuevas. El porqué del
 * cambio, y por qué la decisión que este comentario defiende era correcta cuando se tomó,
 * está en `PRODUCT_DECISIONS.md` (2026-09-18). Lo que sigue es el razonamiento original.
 *
 * AppHeader organism: the staff area's only chrome.
 * SSOT: plan/11-ux.md (operaciones en portátil), DESIGN.md §Superficies.
 *
 * A calm bar and nothing else — no sidebar, no hamburger. With four destinations a top bar
 * is the whole navigation, it reflows at 320 px by wrapping, and it needs no JavaScript,
 * which means it cannot break. The current page is marked with `aria-current` *and* an
 * underline: colour alone never carries meaning (DESIGN.md §Color semántico).
 *
 * Links are filtered by capability before they get here: a door you cannot open should not
 * be on the wall.
 *
 * Client component for one reason: `usePathname`. A layout cannot know its own path, and
 * marking the current page matters more than saving this much JavaScript.
 */

'use client';

import Link from 'next/link';
import { LogoutButton } from '@/components/organisms/logout-dialog';
import { usePathname } from 'next/navigation';
import type { NavDestination } from '@/lib/nav/staff-nav';

export interface AppHeaderProps {
  institutionName: string;
  items: NavDestination[];
  /** Who is signed in, so it is obvious whose session this is. */
  personName: string | null;
  /**
   * Avisos sin leer. El contador va en **texto**, no en un punto de color
   * (plan/11-ux.md:79: "campana con contador en texto"): un punto rojo no se lee en voz
   * alta y no dice cuántos son.
   */
  unreadNotifications?: number;
}

function isActive(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppHeader({
  institutionName,
  items,
  personName,
  unreadNotifications = 0,
}: AppHeaderProps) {
  const currentPath = usePathname();

  return (
    <header className="bg-surface-base border-border border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/ingresar"
          className="type-body-emphasis text-text min-h-touch flex items-center"
        >
          {institutionName}
        </Link>

        <nav aria-label="Principal" className="flex-1">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {items.map((item) => {
              const active = isActive(currentPath, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`type-body min-h-touch flex items-center ${
                      active
                        ? 'text-text underline decoration-2 underline-offset-8'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          {personName && <span className="type-caption text-text-muted">{personName}</span>}
          <Link
            href="/notificaciones"
            aria-current={isActive(currentPath, '/notificaciones') ? 'page' : undefined}
            className={`type-body min-h-touch flex items-center ${
              isActive(currentPath, '/notificaciones')
                ? 'text-text underline decoration-2 underline-offset-8'
                : 'text-text-link underline'
            }`}
          >
            {unreadNotifications > 0
              ? `Notificaciones (${unreadNotifications} sin leer)`
              : 'Notificaciones'}
          </Link>
          <LogoutButton
            icon={false}
            className="type-body text-text-link min-h-touch flex items-center underline"
          />
        </div>
      </div>
    </header>
  );
}
