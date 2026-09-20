'use client';

/**
 * NavItem: ir a otro sitio. No es un botón.
 * SSOT: reference/03-ui/layout-y-componentes.md §5.
 *
 * La regla que justifica que exista: **navegar y actuar no comparten componente**, aunque en
 * pantalla se parezcan. Esto renderiza un `<a>`, así que se abre en otra pestaña con el botón
 * central y se copia con el menú contextual; un `<button>` con `router.push` no hace ninguna
 * de las dos cosas y nadie sabe por qué.
 *
 * `hover` y `selected` son **estados distintos** (§6) y por eso llevan tratamientos que no se
 * parecen: el activo lleva fondo, peso de texto y `aria-current`, y el `hover` solo fondo. Un
 * activo que se distinguiera solo por el color desaparecería para quien no lo distingue, y el
 * `hover` no existe en teclado ni en pantalla táctil.
 *
 * Lo bloqueado no se esconde: se muestra en su sitio, apagado y con su razón (§5). Una puerta
 * que no puedes abrir tiene que seguir en la pared, o preguntas por ella a soporte.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NavItemProps {
  href: string;
  children: ReactNode;
  /** La página actual. Pone `aria-current="page"`, que es lo que lee el lector de pantalla. */
  active?: boolean;
  /** Icono decorativo a la izquierda. Nunca lleva el significado él solo. */
  icon?: ReactNode;
  /** Algo a la derecha: un contador, un candado. En texto, no un punto de color. */
  trailing?: ReactNode;
  /**
   * Sin permiso para entrar. Renderiza un `<span>` y no un enlace —no hay nada adonde ir— y
   * exige decir por qué.
   */
  locked?: boolean;
  /** La razón, obligatoria si `locked`. Se lee; no es un `title` que solo aparece al pasar. */
  lockedReason?: string;
  /**
   * Para quien envuelve el enlace y necesita reaccionar al viaje —cerrar un cajón, por
   * ejemplo—. Va **aquí, en el `<a>`**, y no en un `div` que envuelva la lista: un manejador
   * en un `div` no se dispara con teclado, y es justo lo que prohíbe §5 del contrato.
   */
  onClick?: () => void;
  className?: string;
}

/*
  El alto lo decide el CONTENEDOR, no el ítem: `min-h-control` lee
  `--density-control-height`, así que la columna de escritorio puede ir en `density-compact`
  (36 px) y el cajón del teléfono quedarse en el de por defecto (44 px). Es el primer
  consumidor de los tokens de densidad y es exactamente el caso que la regla permite:
  `compact` solo donde el puntero es un ratón (`layout-y-componentes.md` §2b).
*/
const BASE =
  'flex items-center gap-3 rounded-control px-3 min-h-control w-full transition-colors duration-fast ease-standard';

export function NavItem({
  href,
  children,
  active = false,
  icon,
  trailing,
  locked = false,
  lockedReason,
  onClick,
  className,
}: NavItemProps) {
  if (locked) {
    return (
      <span className={cn(BASE, 'text-status-locked-base cursor-default', className)}>
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="flex-1">{children}</span>
        {lockedReason && <span className="type-caption sr-only">{lockedReason}</span>}
        {trailing}
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        BASE,
        /*
          El activo NO cambia de peso. Con `type-body-emphasis` la etiqueta ensanchaba al
          navegar y la columna entera daba un salto; y el peso, además, no lo lee nadie. Lo
          que distingue al activo es fondo, color y `aria-current` — tres señales, ninguna
          dependiente de que se note un grosor.
        */
        active
          ? 'bg-surface-sunken text-text'
          : 'text-text-muted hover:bg-surface-sunken hover:text-text',
        className
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="flex-1">{children}</span>
      {trailing}
    </Link>
  );
}
