/** @jest-environment jsdom */
/**
 * Tests for Card.
 * SSOT: reference/03-ui/layout-y-componentes.md §3 y §4.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('con título es una región con nombre, para poder saltar a ella', () => {
    render(
      <Card title="Mi suscripción">
        <p>contenido</p>
      </Card>
    );

    expect(screen.getByRole('region', { name: 'Mi suscripción' })).toBeInTheDocument();
  });

  it('con labelledBy es una región cuyo nombre lo pone otro elemento, sin encabezado propio', () => {
    render(
      <>
        <label id="editor-texto" htmlFor="campo">
          Contenido del tema
        </label>
        <Card labelledBy="editor-texto">
          <textarea id="campo" />
        </Card>
      </>
    );

    expect(screen.getByRole('region', { name: 'Contenido del tema' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('sin título no se anuncia como región: una región sin nombre no se sabe decir', () => {
    render(
      <Card>
        <p>contenido</p>
      </Card>
    );

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('el encabezado es h3 por defecto, porque vive dentro de una sección', () => {
    render(
      <Card title="Video">
        <p>contenido</p>
      </Card>
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Video' })).toBeInTheDocument();
  });

  it('acepta otro nivel cuando cuelga de otro sitio', () => {
    render(
      <Card title="Video" as="h2">
        <p>contenido</p>
      </Card>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Video' })).toBeInTheDocument();
  });

  /*
    Lo que este test protege no ha cambiado: que la tarjeta agrupe con BORDE. Desde el 18/9
    además lleva `elevation-resting`, una sombra muy baja que en claro la despega del lienzo y
    en oscuro no se nota — refuerzo, no mecanismo. Por eso la aserción del borde sigue siendo
    la importante, y lo que se prohíbe es que la tarjeta se vista de algo que flota.
  */
  it('agrupa con borde: en modo oscuro una sombra no agrupa nada', () => {
    const { container } = render(
      <Card title="Video">
        <p>contenido</p>
      </Card>
    );

    const card = container.querySelector('section');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('elevation-resting');
    expect(card?.className).not.toMatch(/elevation-(floating|modal)/);
  });

  it('pinta la acción que se le da', () => {
    render(
      <Card title="Video" action={<button type="button">Quitar</button>}>
        <p>contenido</p>
      </Card>
    );

    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
  });
});
