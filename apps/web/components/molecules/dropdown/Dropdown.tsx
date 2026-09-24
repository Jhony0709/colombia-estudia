'use client';

/**
 * Dropdown: un menú que se abre desde un disparador (21/9), a la manera del de HeroUI.
 * SSOT: reference/03-ui/layout-y-componentes.md §4 (menús), tokens de `design-tokens`.
 *
 * Composición, como en HeroUI: `Dropdown` › `DropdownTrigger` + `DropdownMenu` ›
 * (`DropdownSection` ›) `DropdownItem`. El ítem admite `description`, `startContent`,
 * `endContent`, `shortcut` y `color="danger"`; el menú admite `onAction(key)` además del
 * `onSelect` de cada ítem.
 *
 * Por debajo sigue Radix DropdownMenu: teclado (flechas, Home/End, letra), foco, `Escape`,
 * cierre al pulsar fuera, portal y colocación. Lo que pone `motion` es la entrada y la
 * salida —escala 0.95 → 1 con muelle, y el fundido al cerrar, que Radix por sí solo no puede
 * animar porque desmonta el contenido de golpe—. Con `prefers-reduced-motion` no hay
 * animación: aparece y desaparece, sin más.
 *
 * Colores solo por token (`surface`, `text`, `border`, `status`): un ítem `danger` tiñe el
 * texto, no el bloque (§7: el rojo señala, no grita).
 */

import * as Radix from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ─────────────────────────── contexto ───────────────────────────

interface OpenContextValue {
  open: boolean;
}

/**
 * El `open` de la raíz, para `AnimatePresence`: Radix desmonta el contenido al cerrar y la
 * salida no se vería; con `forceMount` lo deja montado y aquí se decide cuándo se va.
 */
const OpenContext = createContext<OpenContextValue>({ open: false });

interface MenuContextValue {
  onAction?: (key: string) => void;
}

const MenuContext = createContext<MenuContextValue>({});

/**
 * Una sección con `selectionMode="single"` convierte sus ítems en radios (Radix
 * `RadioGroup`/`RadioItem`): el elegido lleva una marca y `aria-checked`, y el lector de
 * pantalla anuncia «opción 2 de 3, seleccionada». Es lo que HeroUI llama `selectedKeys`.
 */
interface SelectionContextValue {
  selectedKey: string | null;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

// ─────────────────────────── raíz y disparador ───────────────────────────

export interface DropdownProps {
  children: ReactNode;
  /** Controlado, si hace falta; si no, el menú lleva su propio estado. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({ children, open, onOpenChange }: DropdownProps) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (next: boolean) => {
    setInner(next);
    onOpenChange?.(next);
  };
  return (
    <OpenContext.Provider value={{ open: isOpen }}>
      <Radix.Root open={isOpen} onOpenChange={setOpen} modal={false}>
        {children}
      </Radix.Root>
    </OpenContext.Provider>
  );
}

/** Envuelve el botón que abre el menú. `asChild`: el hijo ES el botón, con sus aria. */
export function DropdownTrigger({ children }: { children: ReactNode }) {
  return <Radix.Trigger asChild>{children}</Radix.Trigger>;
}

// ─────────────────────────── menú ───────────────────────────

export interface DropdownMenuProps {
  /** Lo que anuncia el menú. Obligatorio: «menú» no dice de qué. */
  'aria-label': string;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Se llama con la `itemKey` del ítem elegido, además del `onSelect` del propio ítem. */
  onAction?: (key: string) => void;
  className?: string;
}

const ENTER = { opacity: 1, scale: 1, y: 0 } as const;
const EXIT = { opacity: 0, scale: 0.95, y: -4 } as const;

export function DropdownMenu({
  'aria-label': ariaLabel,
  children,
  align = 'end',
  side = 'bottom',
  onAction,
  className,
}: DropdownMenuProps) {
  const { open } = useContext(OpenContext);
  const reduced = useReducedMotion() === true;

  return (
    <MenuContext.Provider value={{ onAction }}>
      <AnimatePresence>
        {open && (
          <Radix.Portal forceMount>
            <Radix.Content
              forceMount
              aria-label={ariaLabel}
              align={align}
              side={side}
              sideOffset={6}
              collisionPadding={8}
              asChild
            >
              <motion.div
                initial={reduced ? false : EXIT}
                animate={ENTER}
                exit={reduced ? undefined : EXIT}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 32, mass: 0.6 }
                }
                style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
                className={cn(
                  'bg-surface-raised border-border-muted rounded-card elevation-floating min-w-52 border p-1',
                  'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto',
                  'z-20 outline-none',
                  className
                )}
              >
                {children}
              </motion.div>
            </Radix.Content>
          </Radix.Portal>
        )}
      </AnimatePresence>
    </MenuContext.Provider>
  );
}

// ─────────────────────────── sección ───────────────────────────

export interface DropdownSectionProps {
  title?: string;
  /** Una raya después de la sección. */
  showDivider?: boolean;
  children: ReactNode;
  /** `single`: los ítems son radios y uno está elegido (`selectedKey`). */
  selectionMode?: 'none' | 'single';
  selectedKey?: string | null;
  onSelectionChange?: (key: string) => void;
  /** `row`: los ítems en una fila (iconos, por ejemplo) en vez de en columna. */
  layout?: 'column' | 'row';
}

const LABEL_CLASS = 'type-caption text-text-muted px-3 pt-2 pb-1';

export function DropdownSection({
  title,
  showDivider = false,
  children,
  selectionMode = 'none',
  selectedKey = null,
  onSelectionChange,
  layout = 'column',
}: DropdownSectionProps) {
  const groupClass = layout === 'row' ? 'flex items-center gap-1 px-1 py-1' : undefined;
  const body =
    selectionMode === 'single' ? (
      <SelectionContext.Provider value={{ selectedKey }}>
        <Radix.RadioGroup
          value={selectedKey ?? undefined}
          onValueChange={onSelectionChange}
          className={groupClass}
        >
          {title && <Radix.Label className={LABEL_CLASS}>{title}</Radix.Label>}
          {children}
        </Radix.RadioGroup>
      </SelectionContext.Provider>
    ) : (
      <Radix.Group className={groupClass}>
        {title && <Radix.Label className={LABEL_CLASS}>{title}</Radix.Label>}
        {children}
      </Radix.Group>
    );

  return (
    <>
      {body}
      {showDivider && <DropdownSeparator />}
    </>
  );
}

/** La raya que separa lo ocasional de lo que no tiene vuelta atrás. */
export function DropdownSeparator() {
  return <Radix.Separator className="bg-border-muted my-1 h-px" />;
}

// ─────────────────────────── ítem ───────────────────────────

export interface DropdownItemProps {
  /** La clave que recibe `onAction` del menú. */
  itemKey?: string;
  children: ReactNode;
  /** Segunda línea, en `text.muted`: qué hace, cuándo, para quién. */
  description?: string;
  /** Un icono o similar, delante. */
  startContent?: ReactNode;
  /** Algo detrás: un badge, una flecha. */
  endContent?: ReactNode;
  /** Atajo de teclado, escrito como se pulsa («⌘N»). Solo informativo. */
  shortcut?: string;
  /**
   * `danger` borra o deshace algo. Tiñe el texto con `status.error`, no el bloque: el rojo
   * señala, no grita (§7). Va al final, detrás de un separador.
   */
  color?: 'default' | 'danger';
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
  /**
   * Solo el icono, cuadrado: `children` pasa a ser el nombre para el lector de pantalla y
   * el tooltip no hace falta porque el elegido se ve por el fondo. Para filas de tres o
   * cuatro opciones que se reconocen por el icono (tema, densidad).
   */
  iconOnly?: boolean;
}

export function DropdownItem({
  itemKey,
  children,
  description,
  startContent,
  endContent,
  shortcut,
  color = 'default',
  disabled = false,
  onSelect,
  className,
  iconOnly = false,
}: DropdownItemProps) {
  const { onAction } = useContext(MenuContext);
  const selection = useContext(SelectionContext);

  const handleSelect = () => {
    onSelect?.();
    if (itemKey !== undefined) onAction?.(itemKey);
  };

  const itemClass = cn(
    'rounded-control min-h-touch flex cursor-pointer items-center outline-none',
    iconOnly ? 'min-w-touch justify-center px-0' : 'gap-3 px-3 py-1.5',
    'duration-fast ease-standard transition-colors',
    'data-[highlighted]:bg-surface-sunken data-[state=checked]:bg-surface-sunken',
    // Deshabilitado con su color, no con opacidad: `text.subtle` sigue cumpliendo 4.5:1.
    disabled && 'text-text-subtle cursor-default',
    !disabled && color === 'danger' && 'text-status-error-base',
    !disabled && color === 'default' && 'text-text',
    className
  );

  const content = iconOnly ? (
    <>
      <span className="flex shrink-0 items-center [&>svg]:size-[18px]">{startContent}</span>
      <span className="sr-only">{children}</span>
    </>
  ) : (
    <>
      {startContent && (
        <span className="flex shrink-0 items-center [&>svg]:size-4">{startContent}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="type-body block truncate">{children}</span>
        {description && (
          <span
            className={cn('type-caption block', disabled ? 'text-text-subtle' : 'text-text-muted')}
          >
            {description}
          </span>
        )}
      </span>
      {shortcut && (
        <kbd className="type-caption text-text-muted border-border-muted rounded-control shrink-0 border px-1.5 font-sans">
          {shortcut}
        </kbd>
      )}
      {endContent && <span className="flex shrink-0 items-center">{endContent}</span>}
      {selection && (
        <Radix.ItemIndicator className="flex shrink-0 items-center">
          <Check aria-hidden className="size-4" />
        </Radix.ItemIndicator>
      )}
    </>
  );

  if (selection) {
    return (
      <Radix.RadioItem
        value={itemKey ?? ''}
        disabled={disabled}
        onSelect={handleSelect}
        className={itemClass}
      >
        {content}
      </Radix.RadioItem>
    );
  }

  return (
    <Radix.Item disabled={disabled} onSelect={handleSelect} className={itemClass}>
      {content}
    </Radix.Item>
  );
}
