/**
 * Button atom.
 * SSOT: reference/03-ui/componentes.md (when created)
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
  'inline-flex items-center justify-center gap-2 rounded-control min-h-touch min-w-touch font-medium transition-colors duration-fast ease-standard',
  {
    variants: {
      variant: {
        primary: 'bg-accent-base text-text-on-accent hover:bg-accent-hover active:bg-accent-active',
        secondary:
          'bg-surface-base text-text border border-border hover:bg-surface-sunken active:bg-surface-sunken',
        quiet: 'text-text hover:bg-surface-sunken active:bg-surface-sunken',
      },
      size: {
        default: 'px-4 py-2 type-body',
        lg: 'px-6 py-3 type-subheading',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

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
          isDisabled && 'text-text-subtle pointer-events-none',
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
