/** @jest-environment jsdom */
/**
 * Tests for Button atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'loading' ? 'Cargando…' : key),
}));

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('renders as button by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('is keyboard accessible with Enter', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Enviar</Button>);

    const button = screen.getByRole('button');
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is keyboard accessible with Space', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Enviar</Button>);

    const button = screen.getByRole('button');
    button.focus();
    await userEvent.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled button does not trigger onClick', async () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} disabled>
        Enviar
      </Button>
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled button has aria-disabled', () => {
    render(<Button disabled>Enviar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('disabled button has pointer-events-none class, not opacity', () => {
    render(<Button disabled>Enviar</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('pointer-events-none');
    // Should NOT have opacity class
    expect(button.className).not.toMatch(/opacity/);
  });

  it('asChild renders as anchor when given an anchor child', () => {
    render(
      <Button asChild>
        <a href="/test">Enlace</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Enlace' });
    expect(link).toHaveAttribute('href', '/test');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('asChild + loading renders spinner inside the anchor (Slottable)', () => {
    render(
      <Button asChild loading>
        <a href="/test">Enlace</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: /Enlace/ });
    expect(link).toHaveAttribute('aria-busy', 'true');
    expect(link.querySelector('.animate-spin')).toBeInTheDocument();
    expect(link).toHaveTextContent('Enlace');
  });

  it('asChild + disabled uses aria-disabled and tabIndex=-1, never the disabled attribute', () => {
    render(
      <Button asChild disabled>
        <a href="/test">Enlace</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Enlace' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).not.toHaveAttribute('disabled');
  });

  it('loading shows aria-busy', () => {
    render(<Button loading>Enviando</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('loading shows spinner and children', () => {
    render(<Button loading>Enviando</Button>);
    const button = screen.getByRole('button');

    // Spinner is present (aria-hidden span with animate-spin)
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Children are still visible
    expect(button).toHaveTextContent('Enviando');
  });

  it('loading disables the button', async () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} loading>
        Enviando
      </Button>
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  describe('variants', () => {
    it('primary has bg-accent-base', () => {
      render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-accent-base');
    });

    it('secondary has bg-surface-base and border', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-surface-base');
      expect(button).toHaveClass('border');
    });

    it('quiet has no background until hover', () => {
      render(<Button variant="quiet">Quiet</Button>);
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('bg-accent-base');
      expect(button).not.toHaveClass('bg-surface-base');
    });
  });

  describe('sizes', () => {
    it('default size has type-body', () => {
      render(<Button size="default">Default</Button>);
      expect(screen.getByRole('button')).toHaveClass('type-body');
    });

    it('lg size has type-subheading', () => {
      render(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('type-subheading');
    });
  });

  it('has minimum touch target size', () => {
    render(<Button>Touch</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-touch');
    expect(button).toHaveClass('min-w-touch');
  });
});
