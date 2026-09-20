/** @jest-environment jsdom */
/**
 * Tests for Badge.
 * SSOT: reference/03-ui/layout-y-componentes.md §3, plan/11-ux.md:79.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('el estado se lee como texto, no solo como color', () => {
    render(<Badge variant="success">Publicado (v2)</Badge>);

    expect(screen.getByText('Publicado (v2)')).toBeInTheDocument();
  });

  it('cada variante pinta su propio fondo, y neutral es la de por defecto', () => {
    const { container, rerender } = render(<Badge>Borrador</Badge>);
    expect(container.firstChild).toHaveClass('bg-surface-sunken');

    rerender(<Badge variant="error">Bloqueado</Badge>);
    expect(container.firstChild).toHaveClass('bg-status-error-muted');
  });
});
