/** @jest-environment jsdom */
/**
 * Tests for Input atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('renders text input by default', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
  });

  it('accepts type prop', () => {
    render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('renders password input', () => {
    render(<Input type="password" />);
    // Password inputs don't have textbox role
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('shows placeholder', () => {
    render(<Input placeholder="Ingresa tu correo" />);
    expect(screen.getByPlaceholderText('Ingresa tu correo')).toBeInTheDocument();
  });

  it('accepts user input', async () => {
    render(<Input />);
    const input = screen.getByRole('textbox');

    await userEvent.type(input, 'test@example.com');
    expect(input).toHaveValue('test@example.com');
  });

  it('allows pasting', async () => {
    render(<Input />);
    const input = screen.getByRole('textbox');

    await userEvent.click(input);
    await userEvent.paste('pasted-text');
    expect(input).toHaveValue('pasted-text');
  });

  it('applies error border when hasError', () => {
    render(<Input hasError />);
    expect(screen.getByRole('textbox')).toHaveClass('border-status-error-base');
  });

  it('applies normal border when not hasError', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toHaveClass('border-border');
  });

  it('disabled input cannot receive input', async () => {
    render(<Input disabled defaultValue="initial" />);
    const input = screen.getByRole('textbox');

    expect(input).toBeDisabled();
    await userEvent.type(input, 'new text');
    expect(input).toHaveValue('initial');
  });

  it('disabled input has cursor-not-allowed class, not opacity', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('cursor-not-allowed');
    expect(input.className).not.toMatch(/opacity/);
  });

  it('has minimum touch target size', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toHaveClass('min-h-touch');
  });

  it('accepts custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through aria attributes', () => {
    render(<Input aria-describedby="hint-id" aria-invalid />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'hint-id');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
