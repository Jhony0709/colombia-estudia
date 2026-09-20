'use client';

/**
 * SideNav: la navegación de las áreas con sesión (staff y, desde el 20/9, estudiante).
 * SSOT: reference/03-ui/layout-y-componentes.md §5, PRODUCT_DECISIONS.md 2026-09-18.
 *
 * **Revierte la decisión escrita en `AppHeader`** («a calm bar and nothing else — no sidebar,
 * no hamburger»). Aquella era correcta con cuatro destinos; el motivo del cambio no es cómo
 * está hoy sino que `app/(staff)/layout.tsx` ya nombra aliados, cartera e inclusión, y con
 * siete destinos una barra superior se parte en dos líneas y deja de ser una barra.
 *
 * Lo que costaba y hay que pagar bien: en el teléfono la navegación va detrás de un botón, y
 * un cajón hecho a mano es una trampa de accesibilidad. Por eso el cajón es `Radix Dialog`,
 * que ya trae lo del patrón APG —foco atrapado dentro, `Escape` cierra, el foco vuelve al
 * botón que lo abrió— en vez de reimplementarlo peor.
 *
 * `usePathname` obliga a que sea cliente. Marcar la página actual importa más que ese
 * JavaScript, igual que ya razonaba `AppHeader`.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/atoms/brand-logo';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  Accessibility,
  Award,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Layers,
  Library,
  LogOut,
  Map,
  Menu,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavItem } from '@/components/atoms/nav-item';
import { ThemeToggle } from '@/components/molecules/theme-toggle';
import type { Theme } from '@/lib/theme/theme';
import type { NavDestination } from '@/lib/nav/staff-nav';

export interface SideNavProps {
  institutionName: string;
  items: NavDestination[];
  personName: string | null;
  /**
   * Avisos sin leer. El contador va en **texto**, no en un punto de color
   * (`plan/11-ux.md:79`): un punto rojo no se lee en voz alta y no dice cuántos son.
   */
  unreadNotifications?: number;
  /** El tema elegido, leído de la cookie en el layout: el conmutador arranca en el correcto. */
  theme: Theme;
  /** Los grupos, en orden. Por defecto los de staff; el área del estudiante trae los suyos. */
  sections?: ReadonlyArray<{ key: string; label: string }>;
  /** A dónde lleva la marca. Staff: `/ingresar`; estudiante: `/aprender`. */
  homeHref?: string;
  /** El centro de notificaciones del área (staff `/notificaciones`, estudiante `/aprender/notificaciones`). */
  notificationsHref?: string;
}

/**
 * `currentPath` puede llegar vacío.
 *
 * `usePathname()` devuelve `null` cuando no hay router montado —en Storybook sin
 * `parameters.nextjs.navigation`, y en la aplicación durante algunas transiciones—. Sin este
 * guardia, `null.startsWith` lanza dentro de `SideNav`, y `SideNav` vive en el layout: no se
 * cae un widget, se cae **toda el área de staff**. Lo descubrió el test-runner el 18/9,
 * reventando las cuatro stories antes de llegar a comprobar nada.
 */
/*
  Icono por destino. Vive aquí y no en `lib/nav/staff-nav.ts` para que ese módulo siga siendo
  puro y comprobable sin React. Son decorativos: van con `aria-hidden` dentro de `NavItem`, y
  el nombre del enlace lo da siempre el texto (AP8 de `ui-craft`).
*/
const ICONS: Record<string, LucideIcon> = {
  '/personas': Users,
  '/cohortes': GraduationCap,
  '/contenido/temas': BookOpen,
  '/contenido/evaluaciones': ClipboardCheck,
  '/contenido/programas': Layers,
  '/contenido/asignaturas': Library,
  '/admin/institucion': Building2,
  '/admin/inclusion/reporte': Accessibility,
  '/cartera': Wallet,
  '/admin/politicas': ShieldCheck,
  // Estudiante (20/9).
  '/aprender': Map,
  '/aprender/calendario': CalendarDays,
  '/aprender/biblioteca': FolderOpen,
  '/aprender/resultados': ChartColumn,
  '/aprender/certificados': Award,
  '/aprender/mi-cuenta': Wallet,
};

/** Los rótulos de grupo, en el orden en que se pintan. */
/**
 * Los grupos, en el orden en que se construye un curso: el plan de estudios, lo que se
 * escribe dentro de él, a quién se le entrega y, al final, la configuración. Ver el porqué
 * en `lib/nav/staff-nav.ts`.
 */
const STAFF_SECTIONS = [
  { key: 'plan', label: 'Plan de estudios' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'operacion', label: 'Operación' },
  { key: 'administracion', label: 'Administración' },
] as const;

function isActive(
  currentPath: string | null,
  href: string,
  activeUnder?: readonly string[]
): boolean {
  if (!currentPath) return false;
  if (currentPath === href) return true;
  // Con `activeUnder`, solo esos prefijos: `/aprender` no debe encender con `/aprender/calendario`.
  if (activeUnder) return activeUnder.some((prefix) => currentPath.startsWith(prefix));
  return currentPath.startsWith(`${href}/`);
}

/** El contenido de la navegación. El mismo en la columna y en el cajón: una sola verdad. */
function NavBody({
  items,
  sections,
  notificationsHref,
  personName,
  unreadNotifications,
  currentPath,
  theme,
  onNavigate,
}: {
  items: NavDestination[];
  sections: ReadonlyArray<{ key: string; label: string }>;
  notificationsHref: string;
  personName: string | null;
  unreadNotifications: number;
  currentPath: string | null;
  theme: Theme;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <nav aria-label="Principal" className="flex-1 space-y-4">
        {sections.map((section) => {
          const destinations = items.filter(
            (item) => (item.section ?? 'operacion') === section.key
          );
          if (destinations.length === 0) return null;

          return (
            <div key={section.key}>
              {/*
                El rótulo no es un encabezado: no hay contenido colgando de él, es una
                etiqueta del grupo. Por eso `aria-labelledby` sobre la lista y no un `h*`,
                que metería un nivel falso en el esquema de la página.
              */}
              <p
                id={`nav-${section.key}`}
                className="type-overline text-text-subtle px-3 pb-1 uppercase"
              >
                {section.label}
              </p>
              <ul aria-labelledby={`nav-${section.key}`} className="space-y-0.5">
                {destinations.map((item) => {
                  const Icon = ICONS[item.href];
                  return (
                    <li key={item.href}>
                      <NavItem
                        href={item.href}
                        active={isActive(currentPath, item.href, item.activeUnder)}
                        onClick={onNavigate}
                        icon={Icon ? <Icon className="h-[18px] w-[18px]" /> : undefined}
                      >
                        {item.label}
                      </NavItem>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-border-muted space-y-1 border-t pt-4">
        <NavItem
          href={notificationsHref}
          active={isActive(currentPath, notificationsHref)}
          onClick={onNavigate}
          icon={<Bell className="h-[18px] w-[18px]" />}
          trailing={
            unreadNotifications > 0 ? (
              <span className="type-caption text-text-muted">{unreadNotifications}</span>
            ) : null
          }
        >
          {unreadNotifications > 0
            ? `Notificaciones (${unreadNotifications} sin leer)`
            : 'Notificaciones'}
        </NavItem>

        <ThemeToggle theme={theme} />

        {personName && <p className="type-caption text-text-muted px-3 pt-2">{personName}</p>}
        <NavItem
          href="/auth/logout"
          onClick={onNavigate}
          icon={<LogOut className="h-[18px] w-[18px]" />}
        >
          Cerrar sesión
        </NavItem>
      </div>
    </div>
  );
}

export function SideNav({
  institutionName,
  items,
  personName,
  unreadNotifications = 0,
  theme,
  sections = STAFF_SECTIONS,
  homeHref = '/ingresar',
  notificationsHref = '/notificaciones',
}: SideNavProps) {
  const currentPath = usePathname() as string | null;
  const [open, setOpen] = useState(false);

  // Cambiar de página cierra el cajón. Cada `NavItem` además lo cierra al pulsarlo, y no es
  // redundante: tocar el enlace de la página en la que ya estás no cambia la ruta, así que
  // este efecto solo no se enteraría y el cajón se quedaría abierto.
  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  const brand = (
    <Link
      href={homeHref}
      className="type-body-emphasis text-text min-h-touch flex items-center gap-2 px-3"
    >
      {/* Isotipo decorativo: el nombre ya va escrito al lado. */}
      <BrandLogo variant="isotipo" alt="" className="h-7" />
      {institutionName}
    </Link>
  );

  return (
    <>
      {/* Escritorio: la columna, siempre visible, sin JavaScript de por medio. */}
      {/*
        `density-compact` en la columna de escritorio: filas de 36 px en vez de 44. Baja del
        objetivo presionable a propósito y solo aquí, que es donde hay ratón; el cajón del
        teléfono, más abajo, se queda en la densidad por defecto. La regla y su límite están
        en `layout-y-componentes.md` §2b.
      */}
      <div className="bg-surface-canvas border-border-muted w-sidenav density-compact type-data hidden shrink-0 border-r p-2 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-5">
        {brand}
        <NavBody
          items={items}
          sections={sections}
          notificationsHref={notificationsHref}
          personName={personName}
          unreadNotifications={unreadNotifications}
          currentPath={currentPath}
          theme={theme}
        />
      </div>

      {/* Teléfono: una barra delgada y el cajón detrás del botón. */}
      <header className="bg-surface-canvas border-border-muted flex items-center gap-2 border-b px-2 py-2 lg:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          {/*
            Sin tooltip, a propósito (19/9): esta barra solo existe en el teléfono (`lg:hidden`),
            donde no hay hover, y un tooltip sobre el botón que abre un diálogo modal se abre
            solo cuando el foco vuelve al botón al cerrarlo. El nombre va en `VisuallyHidden`.
          */}
          <Dialog.Trigger className="text-text min-h-touch min-w-touch rounded-control hover:bg-surface-sunken flex items-center justify-center">
            <Menu aria-hidden="true" className="h-5 w-5" />
            <VisuallyHidden>Abrir la navegación</VisuallyHidden>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 lg:hidden" />
            <Dialog.Content className="bg-surface-base elevation-modal w-sidenav fixed inset-y-0 left-0 z-50 flex flex-col gap-6 p-3 lg:hidden">
              <VisuallyHidden>
                <Dialog.Title>Navegación</Dialog.Title>
              </VisuallyHidden>

              <div className="flex items-center justify-between">
                {brand}
                {/*
                  Sin tooltip: es lo primero que recibe el foco al abrir el cajón, y un tooltip
                  que se abre con el foco saltaría solo y se comería el primer Escape (la capa
                  del tooltip queda por encima de la del diálogo).
                */}
                <Dialog.Close className="text-text min-h-touch min-w-touch rounded-control hover:bg-surface-sunken flex items-center justify-center">
                  <X aria-hidden="true" className="h-5 w-5" />
                  <VisuallyHidden>Cerrar la navegación</VisuallyHidden>
                </Dialog.Close>
              </div>

              <NavBody
                items={items}
                sections={sections}
                notificationsHref={notificationsHref}
                personName={personName}
                unreadNotifications={unreadNotifications}
                currentPath={currentPath}
                theme={theme}
                onNavigate={() => setOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {brand}
      </header>
    </>
  );
}
