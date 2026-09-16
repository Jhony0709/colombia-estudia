/**
 * PasswordInput atom.
 * SSOT: reference/03-ui/accesibilidad.md:47
 *
 * Password input with show/hide toggle. Allows pasting (NIST 800-63B).
 */

'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input, type InputProps } from '../input';
import { useFormField } from '../form-field';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Autocomplete hint for password managers */
  autoComplete?: 'current-password' | 'new-password';
}

/**
 * Password input with visibility toggle.
 *
 * Features:
 * - Show/hide password toggle with accessible label
 * - Supports both current-password and new-password autocomplete
 * - Allows pasting (required by NIST 800-63B)
 * - Minimum touch target for toggle button
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ autoComplete = 'current-password', className, ...props }, ref) => {
    const t = useTranslations('auth');
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={cn('pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'min-h-touch min-w-touch flex items-center justify-center',
            'text-text-muted hover:text-text',
            'duration-fast ease-standard transition-colors'
          )}
          aria-label={visible ? t('hidePassword') : t('showPassword')}
        >
          {visible ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

// ─────────────────────────── FormPasswordInput ───────────────────────────

export interface FormPasswordInputProps extends Omit<PasswordInputProps, 'id' | 'hasError'> {
  /** Field name (for form submission) */
  name: string;
}

/**
 * PasswordInput that automatically connects to FormField context.
 *
 * Must be used within a FormField. Automatically receives:
 * - id from context
 * - aria-describedby from context
 * - aria-invalid from context
 * - aria-required from context
 * - hasError from context
 */
export const FormPasswordInput = forwardRef<HTMLInputElement, FormPasswordInputProps>(
  ({ name, ...props }, ref) => {
    const fieldProps = useFormField();
    return <PasswordInput ref={ref} name={name} {...fieldProps} {...props} />;
  }
);

FormPasswordInput.displayName = 'FormPasswordInput';
