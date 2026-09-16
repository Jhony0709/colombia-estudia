/** @jest-environment jsdom */
/**
 * Tests for FormField atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormField, FormInput, useFormField } from './FormField';

// Test component that uses useFormField hook
function TestInput({ name }: { name: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hasError, ...fieldProps } = useFormField();
  return <input data-testid="test-input" name={name} {...fieldProps} />;
}

describe('FormField', () => {
  it('renders label and associates with input via htmlFor', () => {
    render(
      <FormField label="Correo" name="email">
        <TestInput name="email" />
      </FormField>
    );

    const label = screen.getByText('Correo');
    const input = screen.getByTestId('test-input');

    expect(label).toHaveAttribute('for', input.id);
  });

  it('generates unique IDs using useId pattern', () => {
    render(
      <>
        <FormField label="Campo 1" name="field1">
          <TestInput name="field1" />
        </FormField>
        <FormField label="Campo 2" name="field2">
          <TestInput name="field2" />
        </FormField>
      </>
    );

    const inputs = screen.getAllByTestId('test-input');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
    // IDs should include the name
    expect(inputs[0]!.id).toContain('field1');
    expect(inputs[1]!.id).toContain('field2');
  });

  it('shows hint when no error', () => {
    render(
      <FormField label="Contraseña" name="password" hint="Mínimo 12 caracteres">
        <TestInput name="password" />
      </FormField>
    );

    expect(screen.getByText('Mínimo 12 caracteres')).toBeInTheDocument();
  });

  it('connects hint to input via aria-describedby', () => {
    render(
      <FormField label="Contraseña" name="password" hint="Mínimo 12 caracteres">
        <TestInput name="password" />
      </FormField>
    );

    const input = screen.getByTestId('test-input');
    const hint = screen.getByText('Mínimo 12 caracteres');

    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });

  it('shows error message with role="alert"', () => {
    render(
      <FormField label="Correo" name="email" error="Correo inválido">
        <TestInput name="email" />
      </FormField>
    );

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Correo inválido');
  });

  it('connects error to input via aria-describedby', () => {
    render(
      <FormField label="Correo" name="email" error="Correo inválido">
        <TestInput name="email" />
      </FormField>
    );

    const input = screen.getByTestId('test-input');
    const error = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('hides hint when error is shown', () => {
    render(
      <FormField label="Correo" name="email" hint="ejemplo@correo.com" error="Correo inválido">
        <TestInput name="email" />
      </FormField>
    );

    expect(screen.queryByText('ejemplo@correo.com')).not.toBeInTheDocument();
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
  });

  it('sets aria-invalid when error present', () => {
    render(
      <FormField label="Correo" name="email" error="Correo inválido">
        <TestInput name="email" />
      </FormField>
    );

    expect(screen.getByTestId('test-input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid when no error', () => {
    render(
      <FormField label="Correo" name="email">
        <TestInput name="email" />
      </FormField>
    );

    expect(screen.getByTestId('test-input')).not.toHaveAttribute('aria-invalid');
  });

  it('shows required asterisk on label', () => {
    render(
      <FormField label="Nombre" name="name" required>
        <TestInput name="name" />
      </FormField>
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('sets aria-required when required', () => {
    render(
      <FormField label="Nombre" name="name" required>
        <TestInput name="name" />
      </FormField>
    );

    expect(screen.getByTestId('test-input')).toHaveAttribute('aria-required', 'true');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <FormField label="Campo" name="field" className="custom-class">
        <TestInput name="field" />
      </FormField>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('FormInput', () => {
  it('integrates with FormField context', () => {
    render(
      <FormField label="Correo" name="email" error="Campo requerido" required>
        <FormInput name="email" type="email" />
      </FormField>
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveClass('border-status-error-base');
  });

  it('throws when used outside FormField', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<FormInput name="orphan" />);
    }).toThrow('useFormField must be used within FormField');

    consoleSpy.mockRestore();
  });
});

describe('useFormField', () => {
  it('throws when used outside FormField', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    function TestComponent() {
      useFormField();
      return null;
    }

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useFormField must be used within FormField');

    consoleSpy.mockRestore();
  });
});
