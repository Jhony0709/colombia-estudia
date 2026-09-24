'use client';

/**
 * Menu: las acciones que no hacen falta siempre a la vista.
 * SSOT: reference/03-ui/layout-y-componentes.md §5 y §7.
 *
 * La regla que lo justifica (§7): *acciones frecuentes visibles; acciones ocasionales bajo un
 * `⋯`; acciones destructivas nunca dominantes*. Siete botones permanentes en cada fila hacen
 * que ninguno se vea, y los que sí importan compiten con los que casi nunca se usan.
 *
 * `MenuItem` existe aparte de `Button` por §5: **navegar, actuar y elegir no comparten
 * componente** aunque en pantalla se parezcan. Un elemento de menú no es un botón suelto; vive
 * dentro de un patrón con sus propias teclas.
 *
 * Es `@radix-ui/react-dropdown-menu`, que ya trae el patrón *menu button* de APG: abre con
 * `Enter`, `Espacio` o flecha abajo, se recorre con las flechas, `Escape` cierra y el foco
 * vuelve al disparador. Escribir eso a mano sale peor, y esta es la parte que de verdad se
 * rompe cuando se hace a ojo.
 */

import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/atoms/tooltip';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/molecules/dropdown';

/**
 * Desde el 21/9 es una piel sobre `molecules/dropdown` (Radix + `motion`): el «⋯» con su
 * tooltip y el menú alineado a la derecha. Los que ya lo usaban no cambian.
 */
export interface MenuProps {
  /**
   * Lo que anuncia el botón. Obligatorio y sin valor por defecto: «menú» no dice de qué,
   * y en una lista de diez preguntas habría diez botones llamados igual.
   */
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
}

export function Menu({ label, children, align = 'end' }: MenuProps) {
  return (
    <Dropdown>
      <Tooltip label={label}>
        <DropdownTrigger>
          <button
            type="button"
            aria-label={label}
            className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch min-w-touch data-[state=open]:bg-surface-sunken inline-flex items-center justify-center"
          >
            <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
          </button>
        </DropdownTrigger>
      </Tooltip>
      <DropdownMenu aria-label={label} align={align}>
        {children}
      </DropdownMenu>
    </Dropdown>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /**
   * Borra o deshace algo. Lo tiñe con `status.error` **en el texto**, no en un bloque rojo:
   * el rojo señala, no grita (§7). Y va al final, detrás de un separador.
   */
  destructive?: boolean;
}

export function MenuItem({
  children,
  onSelect,
  disabled = false,
  destructive = false,
}: MenuItemProps) {
  return (
    <DropdownItem
      onSelect={onSelect}
      disabled={disabled}
      color={destructive ? 'danger' : 'default'}
    >
      {children}
    </DropdownItem>
  );
}

/** La raya que separa lo ocasional de lo que no tiene vuelta atrás. */
export function MenuSeparator() {
  return <DropdownSeparator />;
}
