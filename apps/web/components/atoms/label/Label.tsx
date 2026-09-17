/**
 * Label atom.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Simple label using Radix primitive. The visual asterisk is for sighted users;
 * screen readers get required state from aria-required on the associated input.
 */

import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Show visual asterisk for required fields (screen readers use aria-required on input) */
  required?: boolean;
}

/**
 * Accessible label component.
 *
 * Use htmlFor to associate with form controls. The required prop adds a visual
 * asterisk; the actual required state should be set via aria-required on the input.
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('type-body text-text font-medium', className)}
      {...props}
    >
      {children}
      {required && (
        <span aria-hidden="true" className="text-status-error-base ml-1">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  )
);

Label.displayName = 'Label';
