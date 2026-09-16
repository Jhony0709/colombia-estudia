/** @jest-environment jsdom */
/**
 * Tests for PasswordInput atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput, FormPasswordInput } from './PasswordInput';
import { FormField } from '../form-field';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      showPassword: 'Mostrar contraseña',
      hidePassword: 'Ocultar contraseña',
    };
    return translations[key] || key;
  },
}));

describe('PasswordInput', () => {
  it('renders password input by default (hidden)', () => {
    render(<PasswordInput />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('has show password button', () => {
    render(<PasswordInput />);
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
  });

  it('toggles visibility when button clicked', async () => {
    render(<PasswordInput />);
    const input = document.querySelector('input')!;
    const button = screen.getByRole('button', { name: 'Mostrar contraseña' });

    // Initially hidden
    expect(input).toHaveAttribute('type', 'password');

    // Click to show
    await userEvent.click(button);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();

    // Click to hide again
    await userEvent.click(button);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('uses current-password autocomplete by default', () => {
    render(<PasswordInput />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
  });

  it('supports new-password autocomplete', () => {
    render(<PasswordInput autoComplete="new-password" />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });

  it('allows pasting (NIST 800-63B)', async () => {
    render(<PasswordInput />);
    const input = document.querySelector('input')!;

    await userEvent.click(input);
    await userEvent.paste('pasted-password');

    expect(input).toHaveValue('pasted-password');
  });

  it('allows typing', async () => {
    render(<PasswordInput />);
    const input = document.querySelector('input')!;

    await userEvent.type(input, 'typed-password');
    expect(input).toHaveValue('typed-password');
  });

  it('toggle button has minimum touch target', () => {
    render(<PasswordInput />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-touch');
    expect(button).toHaveClass('min-w-touch');
  });

  it('toggle icon is decorative (aria-hidden)', () => {
    const { container } = render(<PasswordInput />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards hasError prop to input', () => {
    render(<PasswordInput hasError />);
    const input = document.querySelector('input');
    expect(input).toHaveClass('border-status-error-base');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through aria attributes', () => {
    render(<PasswordInput aria-describedby="hint" aria-invalid />);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('aria-describedby', 'hint');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('FormPasswordInput', () => {
  it('integrates with FormField context', () => {
    render(
      <FormField label="Contraseña" name="password" error="Campo requerido" required>
        <FormPasswordInput name="password" />
      </FormField>
    );

    const input = document.querySelector('input')!;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveClass('border-status-error-base');
  });

  it('throws when used outside FormField', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<FormPasswordInput name="orphan" />);
    }).toThrow('useFormField must be used within FormField');

    consoleSpy.mockRestore();
  });
});
