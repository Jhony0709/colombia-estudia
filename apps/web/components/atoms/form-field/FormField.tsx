/**
 * FormField atom.
 * SSOT: reference/03-ui/accesibilidad.md:45
 *
 * Composes Label + Input + error/hint with proper ARIA associations.
 * Uses FormFieldContext instead of cloneElement per correction #5.
 */

'use client';

import { createContext, useContext, useId, forwardRef, type ReactNode } from 'react';
import { Label } from '../label';
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
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
        {children}
        {hint && !hasError && (
          <p id={hintId} className="type-caption text-text-muted">
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
