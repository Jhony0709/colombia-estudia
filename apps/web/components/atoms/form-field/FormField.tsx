/**
 * FormField atom.
 * SSOT: reference/03-ui/accesibilidad.md:45
 *
 * Composes Label + Input + error/hint with proper ARIA associations.
 * Uses FormFieldContext instead of cloneElement per correction #5.
 */

'use client';

import {
  createContext,
  useContext,
  useId,
  forwardRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Info } from 'lucide-react';
import { Label } from '../label';
import { Tooltip } from '../tooltip';
import { Input, type InputProps } from '../input';
import { cn } from '@/lib/utils';

// ─────────────────────────── Context ───────────────────────────

interface FormFieldContextValue {
  inputId: string;
  errorId: string;
  hintId: string;
  hasError: boolean;
  required: boolean;
  describedBy: string | undefined;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/**
 * Hook for child inputs to consume FormField context.
 * Returns props to spread on the input element.
 */
export function useFormField() {
  const ctx = useContext(FormFieldContext);
  if (!ctx) {
    throw new Error('useFormField must be used within FormField');
  }
  return {
    id: ctx.inputId,
    'aria-describedby': ctx.describedBy,
    'aria-invalid': ctx.hasError || undefined,
    'aria-required': ctx.required || undefined,
    hasError: ctx.hasError,
  };
}

// ─────────────────────────── Component ───────────────────────────

export interface FormFieldProps {
  /** Field label text */
  label: string;
  /** Field name (for form submission) */
  name: string;
  /** Error message to display */
  error?: string;
  /** Hint text displayed below input (hidden when error shown) */
  hint?: string;
  /**
   * Dónde va la ayuda (19/9). `below`: párrafo bajo el campo. `icon`: un icono de información
   * junto a la etiqueta con la ayuda en tooltip, para formularios en fila donde el párrafo
   * desalinea los campos (los filtros de Personas). En los dos casos el texto sigue en el DOM
   * y enlazado por `aria-describedby`: el icono es un atajo de ratón, no la única vía.
   */
  hintPlacement?: 'below' | 'icon';
  /** Mark field as required (adds visual asterisk and aria-required) */
  required?: boolean;
  /** Child input component (should use useFormField hook) */
  children: ReactNode;
  /** Additional className for wrapper */
  className?: string;
}

/**
 * Form field wrapper that connects label, input, error, and hint.
 *
 * Features:
 * - Auto-generates unique IDs using useId
 * - Provides context for child inputs via useFormField hook
 * - Proper aria-describedby connecting error/hint to input
 * - Error message with role="alert"
 * - Required indicator (visual + aria-required)
 */
export function FormField({
  label,
  hintPlacement = 'below',
  name,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const uniqueId = useId();
  const inputId = `${uniqueId}-${name}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const hasError = !!error;
  const describedBy =
    [hasError && errorId, hint && !hasError && hintId].filter(Boolean).join(' ') || undefined;

  const contextValue: FormFieldContextValue = {
    inputId,
    errorId,
    hintId,
    hasError,
    required,
    describedBy,
  };

  return (
    <FormFieldContext.Provider value={contextValue}>
      <div className={cn('space-y-1', className)}>
        {hint && hintPlacement === 'icon' ? (
          <span className="flex items-center gap-1">
            <Label htmlFor={inputId} required={required}>
              {label}
            </Label>
            <Tooltip label={hint} side="top">
              {/* Solo ratón: el lector ya recibe la ayuda por aria-describedby al enfocar el campo. */}
              <span
                aria-hidden="true"
                tabIndex={-1}
                className="text-text-subtle hover:text-text inline-flex cursor-help"
              >
                <Info className="size-3.5" />
              </span>
            </Tooltip>
          </span>
        ) : (
          <Label htmlFor={inputId} required={required}>
            {label}
          </Label>
        )}
        {children}
        {hint && !hasError && (
          <p
            id={hintId}
            className={cn('type-caption text-text-muted', hintPlacement === 'icon' && 'sr-only')}
          >
            {hint}
          </p>
        )}
        {hasError && (
          <p id={errorId} role="alert" className="type-caption text-status-error-base">
            {error}
          </p>
        )}
      </div>
    </FormFieldContext.Provider>
  );
}

// ─────────────────────────── FormInput ───────────────────────────

export interface FormInputProps extends Omit<InputProps, 'id' | 'hasError'> {
  /** Field name (for form submission) */
  name: string;
}

/**
 * Input that automatically connects to FormField context.
 *
 * Must be used within a FormField. Automatically receives:
 * - id from context
 * - aria-describedby from context
 * - aria-invalid from context
 * - aria-required from context
 * - hasError from context
 */
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({ name, ...props }, ref) => {
  const fieldProps = useFormField();
  return <Input ref={ref} name={name} {...fieldProps} {...props} />;
});

FormInput.displayName = 'FormInput';

// ─────────────────────────── FormSelect ───────────────────────────

export interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Field name (for form submission) */
  name: string;
  /** Options to render */
  children: ReactNode;
}

/**
 * Native select that connects to FormField context.
 *
 * Native on purpose: it is the control every screen reader, every mobile keyboard and every
 * autofill already knows. Same wiring as FormInput (id, describedby, invalid, required).
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ name, className, children, ...props }, ref) => {
    const fieldProps = useFormField();
    const { hasError, ...aria } = fieldProps;

    return (
      <select
        ref={ref}
        name={name}
        {...aria}
        {...props}
        className={cn(
          'rounded-control bg-surface-sunken w-full border px-3 py-2',
          'type-body text-text min-h-touch',
          'duration-fast ease-standard transition-colors',
          hasError ? 'border-status-error-base' : 'border-border',
          className
        )}
      >
        {children}
      </select>
    );
  }
);

FormSelect.displayName = 'FormSelect';
