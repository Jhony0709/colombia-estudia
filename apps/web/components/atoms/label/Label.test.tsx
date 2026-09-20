/** @jest-environment jsdom */
/**
 * Tests for Label atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Label } from './Label';

describe('Label', () => {
  it('renders children text', () => {
    render(<Label>Correo electrónico</Label>);
    expect(screen.getByText('Correo electrónico')).toBeInTheDocument();
  });

  it('associates with input via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email-input">Correo</Label>
        <input id="email-input" type="email" />
      </>
    );

    const label = screen.getByText('Correo');
    expect(label).toHaveAttribute('for', 'email-input');
  });

  it('shows visual asterisk when required', () => {
    render(<Label required>Nombre</Label>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('asterisk is aria-hidden (screen readers use aria-required on input)', () => {
    render(<Label required>Nombre</Label>);
    const asterisk = screen.getByText('*');
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not show asterisk when not required', () => {
    render(<Label>Opcional</Label>);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  // `body-emphasis` y no `body`: una etiqueta de campo destaca sobre el valor, y antes
  // eso se conseguia pegandole `font-medium` por fuera del sistema de roles.
  // Se mantiene el tamano de `body` a proposito: reducirla a `label` (0,875rem) haria
  // mas pequenas las etiquetas de formulario para un publico que lee de noche en movil.
  it('usa el rol body-emphasis', () => {
    render(<Label>Etiqueta</Label>);
    expect(screen.getByText('Etiqueta')).toHaveClass('type-body-emphasis');
    expect(screen.getByText('Etiqueta')).not.toHaveClass('font-medium');
  });

  it('accepts custom className', () => {
    render(<Label className="custom-class">Etiqueta</Label>);
    expect(screen.getByText('Etiqueta')).toHaveClass('custom-class');
  });
});
