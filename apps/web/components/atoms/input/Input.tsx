/**
 * Input atom.
 * SSOT: reference/03-ui/accesibilidad.md, reference/03-ui/tokens.md
 *
 * Base text input with error state styling. Minimum touch target ensured.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Apply error border styling */
  hasError?: boolean;
}

/**
 * Text input with accessible styling.
 *
 * Features:
 * - Minimum 44px touch target
 * - Error state with red border
 * - Proper focus ring (global styles)
 * - Disabled state without opacity (uses text-text-subtle)
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, type = 'text', disabled, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        // Base styles
        'rounded-control bg-surface-sunken w-full border px-3 py-2',
        'type-body text-text',
        'min-h-touch',
        'placeholder:text-text-muted',
        'duration-fast ease-standard transition-colors',
        // Error vs normal border
        hasError ? 'border-status-error-base' : 'border-border focus:border-accent-base',
        // Disabled state (no opacity, just muted text)
        disabled && 'text-text-subtle cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
);

Input.displayName = 'Input';
