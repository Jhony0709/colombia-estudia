/**
 * Button atom.
 * SSOT: reference/03-ui/layout-y-componentes.md
 *
 * CORRECTION 1: No focus-visible:outline-none (global handles it)
 * CORRECTION 2: Disabled uses aria-disabled and pointer-events-none, not opacity
 * CORRECTION 3: Uses accent.hover/active tokens
 * CORRECTION 4: No sm variant, only default and lg
 * CORRECTION 5: Loading shows spinner + children
 */

import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base: rounded, touch-min, font, transition
  // NO focus-visible:outline-none — global :focus-visible handles ring
  //
  // El tipo lo pone el rol `type-label` (texto dentro de un control), no una utilidad
  // suelta. Antes esta linea llevaba `font-medium` y el tamano `lg` usaba
  // `type-subheading`: el primero parcheaba el peso por fuera del sistema de roles y
  // el segundo vestia un boton con un rol de encabezado. Ahora los dos tamanos
  // comparten rol y solo se diferencian en el relleno.
  'inline-flex items-center justify-center gap-2 rounded-control min-h-touch min-w-touch type-label transition-colors duration-fast ease-standard',
  {
    variants: {
      variant: {
        primary: 'bg-accent-base text-text-on-accent hover:bg-accent-hover active:bg-accent-active',
        secondary:
          'bg-surface-base text-text border border-border hover:bg-surface-sunken active:bg-surface-sunken',
        quiet: 'text-text hover:bg-surface-sunken active:bg-surface-sunken',
      },
      size: {
        default: 'px-4 py-2',
        lg: 'px-6 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

/**
 * El deshabilitado cambia el FONDO, no solo el texto.
 *
 * Hasta el 18/9 solo cambiaba el texto a `text.subtle` y dejaba el fondo del acento. En un
 * botón primario eso deja un texto gris claro sobre un fondo de color: **1.05:1 en oscuro** y
 * 1.83:1 en claro. 1.0 es texto del mismo color que el fondo — el botón desaparecía.
 *
 * WCAG 1.4.3 exime a los controles inactivos del mínimo de contraste. Da igual: un botón que
 * no se lee es un botón roto, y §6 del contrato exige que un deshabilitado venga con su
 * motivo, lo que da por hecho que se puede leer.
 *
 * El tratamiento depende de la variante: `quiet` no tiene fondo, así que dárselo al
 * deshabilitarlo lo convertiría en un botón relleno justo cuando deja de ser pulsable.
 */
const DISABLED: Record<'primary' | 'secondary' | 'quiet', string> = {
  primary: 'bg-surface-sunken text-text-subtle',
  secondary: 'bg-surface-sunken text-text-subtle border-border-muted',
  quiet: 'text-text-subtle',
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as child element (for links styled as buttons) */
  asChild?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Children to render */
  children: ReactNode;
}

/**
 * Primary UI button component.
 *
 * Features:
 * - Three variants: primary, secondary, quiet
 * - Two sizes: default, lg
 * - Loading state with spinner
 * - asChild for polymorphic rendering
 * - Accessible: min 44px touch target, proper disabled state
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const t = useTranslations('button');
    const Comp = asChild ? Slot : 'button';

    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          // CORRECTION 2: Disabled uses aria-disabled and visual cues, not opacity
          isDisabled && `${DISABLED[variant ?? 'primary']} pointer-events-none`,
          className
        )}
        // `disabled` is not a valid attribute on the child of asChild (e.g. <a>);
        // aria-disabled + pointer-events-none + tabIndex=-1 carry the state there.
        disabled={asChild ? undefined : isDisabled}
        tabIndex={asChild && isDisabled ? -1 : undefined}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {/* CORRECTION 5: Show children alongside loading spinner */}
        {loading ? <span className="sr-only">{t('loading')}</span> : null}
        {/*
          Slot requires exactly one React element child. With the spinner/sr-only
          siblings above, `Slottable` tells Slot which child is the element to
          clone; the siblings are rendered inside it. (Radix: Slottable.)
        */}
        {asChild ? <Slottable>{children}</Slottable> : children}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { buttonVariants };
