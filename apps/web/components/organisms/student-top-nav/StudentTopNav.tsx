'use client';

/**
 * La barra superior del área del estudiante (21/9), a la manera de Coursera.
 * SSOT: reference/01-routing/routes.md:27-38, plan/01:40-46.
 *
 * El 20/9 el estudiante pasó a la barra lateral del staff; el 21/9, tras recorrer Coursera,
 * vuelve a una barra arriba: quien estudia tiene tres destinos de estudio y una pantalla que
 * a menudo es un celular, y la columna lateral le quitaba a la ruta del player (`RouteRail`)
 * el sitio que necesita. Lo del staff sigue en `SideNav`; esto es solo para `(student)`.
 *
 * Composición: marca → destinos de «Estudiar» como pestañas → a la derecha, campana con
 * contador y el menú de la persona (iniciales) con «Mi historial», el tema y «Cerrar sesión».
 * Por debajo de `md` las pestañas bajan a una segunda fila con desplazamiento horizontal:
 * siempre en el DOM, siempre alcanzables con teclado, sin cajón.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogoutDialog } from '@/components/organisms/logout-dialog';
import {
  Award,
  BarChart3,
  Bell,
  ChevronDown,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { SpaceSwitcher } from '@/components/molecules/space-switcher';
import type { Space } from '@/lib/nav/spaces';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import type { NavDestination } from '@/lib/nav/staff-nav';
import { toTheme, type Theme } from '@/lib/theme/theme';
import { applyTheme, THEME_OPTIONS } from '@/lib/theme/apply-theme';
import { cn } from '@/lib/utils';

/**
 * Un destino con `activeUnder` se marca **solo** por su ruta exacta y esos prefijos (23/9):
 * «Mis programas» es `/aprender`, y con la regla «href o href/…» quedaba marcado también en
 * Resultados, Constancias y Mi cuenta, que cuelgan de `/aprender/` sin ser la ruta. Los
 * destinos sin `activeUnder` conservan la regla de prefijo (`/aprender/calendario/…`).
 */
function isActive(currentPath: string | null, item: NavDestination): boolean {
  if (!currentPath) return false;
  if (currentPath === item.href) return true;
  if (item.activeUnder) return item.activeUnder.some((prefix) => currentPath.startsWith(prefix));
  return currentPath.startsWith(`${item.href}/`);
}

/** Icono de cada destino de «Mi historial»; uno nuevo sin icono sale sin él, no rompe. */
const PERSONAL_ICONS: Record<string, LucideIcon> = {
  '/aprender/resultados': BarChart3,
  '/aprender/certificados': Award,
  '/aprender/mi-cuenta': Wallet,
  '/familia': Users,
};

const THEME_ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function StudentTopNav({
  institutionName,
  items,
  personName,
  unreadNotifications = 0,
  theme,
  spaces = [],
  homeHref = '/aprender',
  notificationsHref = '/aprender/notificaciones',
}: {
  institutionName: string;
  items: NavDestination[];
  personName: string | null;
  unreadNotifications?: number;
  theme: Theme;
  /** Los espacios de la persona (ola 3, 23/9); con dos o más, la marca es el conmutador. */
  spaces?: Space[];
  homeHref?: string;
  notificationsHref?: string;
}) {
  const currentPath = usePathname() as string | null;
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // «Mis programas» es la raíz y también el player: los destinos que no tienen prefijo propio
  // se marcan por `activeUnder`; los demás por su ruta.
  const primary = items.filter((item) => item.section !== 'historial');
  const personal = items.filter((item) => item.section === 'historial');

  return (
    <header
      data-student-nav
      className="bg-surface-base border-border-muted sticky top-0 z-10 border-b"
    >
      <div className="max-w-site mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <SpaceSwitcher institutionName={institutionName} spaces={spaces} homeHref={homeHref} />

        <nav aria-label="Principal" className="order-last w-full md:order-none md:w-auto md:flex-1">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
            {primary.map((item) => {
              const active = isActive(currentPath, item);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-control min-h-touch type-label inline-flex items-center px-3',
                      'duration-fast ease-standard transition-colors',
                      active
                        ? 'bg-surface-sunken text-text'
                        : 'text-text-muted hover:bg-surface-sunken hover:text-text'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href={notificationsHref}
            aria-current={
              isActive(currentPath, { href: notificationsHref, label: '' }) ? 'page' : undefined
            }
            className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch min-w-touch relative inline-flex items-center justify-center"
          >
            <Bell className="size-5" aria-hidden="true" />
            <span className="sr-only">
              {unreadNotifications > 0
                ? `Notificaciones, ${unreadNotifications} sin leer`
                : 'Notificaciones'}
            </span>
            {unreadNotifications > 0 && (
              <span
                aria-hidden="true"
                className="bg-accent-base text-text-on-accent type-caption absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center"
              >
                {unreadNotifications}
              </span>
            )}
          </Link>

          <Dropdown>
            <DropdownTrigger>
              <button
                type="button"
                aria-label={personName ? `Menú de ${personName}` : 'Menú de la cuenta'}
                className="text-text hover:bg-surface-sunken rounded-control min-h-touch data-[state=open]:bg-surface-sunken inline-flex items-center gap-2 px-2"
              >
                <span
                  aria-hidden="true"
                  className="bg-accent-base text-text-on-accent type-label inline-flex size-8 items-center justify-center rounded-full"
                >
                  {personName ? initialsOf(personName) : '?'}
                </span>
                <span className="type-caption hidden max-w-40 truncate lg:inline">
                  {personName}
                </span>
                <ChevronDown className="text-text-muted size-4" aria-hidden="true" />
              </button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Mi cuenta">
              {personal.length > 0 && (
                <DropdownSection title="Mi historial" showDivider>
                  {personal.map((item) => {
                    const Icon = PERSONAL_ICONS[item.href];
                    return (
                      <DropdownItem
                        key={item.href}
                        itemKey={item.href}
                        startContent={Icon ? <Icon /> : null}
                        onSelect={() => router.push(item.href)}
                      >
                        {item.label}
                      </DropdownItem>
                    );
                  })}
                </DropdownSection>
              )}
              {/* El tema vive aquí desde el 22/9 (antes, tres botones sueltos en la barra):
                  una fila de tres iconos, radios de Radix, el elegido con fondo. */}
              <DropdownSection
                showDivider
                layout="row"
                selectionMode="single"
                selectedKey={currentTheme}
                onSelectionChange={(key) => {
                  const next = toTheme(key);
                  setCurrentTheme(next);
                  applyTheme(next);
                }}
              >
                {THEME_OPTIONS.map((option) => {
                  const Icon = THEME_ICONS[option.value];
                  return (
                    <DropdownItem
                      key={option.value}
                      itemKey={option.value}
                      startContent={<Icon />}
                      iconOnly
                    >
                      {option.label}
                    </DropdownItem>
                  );
                })}
              </DropdownSection>
              <DropdownItem
                itemKey="logout"
                startContent={<LogOut />}
                // Diferido: si el diálogo se abre en el mismo tic, el menú se queda abierto detrás
                // (visto el 23/9). Con el menú ya cerrado, el diálogo toma el foco limpio.
                onSelect={() => window.setTimeout(() => setLogoutOpen(true), 0)}
              >
                Cerrar sesión
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          {/* Fuera del menú: el menú se cierra al elegir y el diálogo vive aparte (23/9). */}
          <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
        </div>
      </div>
    </header>
  );
}
