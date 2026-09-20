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
  /*
    El deshabilitado tiene que apagar el FONDO, no solo el texto.

    Con solo el texto, un primario deshabilitado quedaba en 1.05:1 en oscuro: gris claro sobre
    el acento, es decir, invisible. Esto fija que el fondo deje de ser el acento; el par
    `text.subtle / surface.sunken` lo vigila por el lado del contraste en design-tokens.
  */
  it('un primario deshabilitado deja de llevar el fondo del acento', () => {
    render(<Button disabled>Crear</Button>);

    const button = screen.getByRole('button', { name: 'Crear' });
    expect(button).toHaveClass('bg-surface-sunken');
    expect(button).not.toHaveClass('bg-accent-base');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('un `quiet` deshabilitado NO gana fondo: se volvería relleno al dejar de pulsarse', () => {
    render(
      <Button variant="quiet" disabled>
        Quitar
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Quitar' });
    expect(button).toHaveClass('text-text-subtle');
    expect(button).not.toHaveClass('bg-surface-sunken');
  });

  it('cargando también apaga el fondo: no se puede pulsar', () => {
    render(<Button loading>Guardar</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-surface-sunken');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

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
    // El tipo de un boton es el rol `label` (texto dentro de un control) en los dos
    // tamanos: lo unico que los diferencia es el relleno. Antes `lg` usaba
    // `type-subheading`, que es un rol de encabezado, y el peso venia de un
    // `font-medium` suelto en la clase base.
    it.each(['default', 'lg'] as const)('el tamano %s usa el rol label', (size) => {
      render(<Button size={size}>Boton</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('type-label');
      expect(button).not.toHaveClass('type-body');
      expect(button).not.toHaveClass('type-subheading');
      expect(button).not.toHaveClass('font-medium');
    });

    it('los tamanos se diferencian solo en el relleno', () => {
      const { unmount } = render(<Button size="default">Default</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2');
      unmount();

      render(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3');
    });
  });

  it('has minimum touch target size', () => {
    render(<Button>Touch</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-touch');
    expect(button).toHaveClass('min-w-touch');
  });
});
