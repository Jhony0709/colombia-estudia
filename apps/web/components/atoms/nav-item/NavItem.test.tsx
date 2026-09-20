/** @jest-environment jsdom */
/**
 * Tests for NavItem.
 * SSOT: reference/03-ui/layout-y-componentes.md §5 y §6.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavItem } from './NavItem';

describe('NavItem', () => {
  it('navega con un enlace de verdad, no con un botón', () => {
    render(<NavItem href="/personas">Personas</NavItem>);

    const link = screen.getByRole('link', { name: 'Personas' });
    expect(link).toHaveAttribute('href', '/personas');
  });

  it('marca la página actual con aria-current y no solo con color', () => {
    render(
      <>
        <NavItem href="/personas" active>
          Personas
        </NavItem>
        <NavItem href="/cohortes">Cohortes</NavItem>
      </>
    );

    expect(screen.getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cohortes' })).not.toHaveAttribute('aria-current');
  });

  it('el activo y el hover no comparten tratamiento', () => {
    const { rerender } = render(<NavItem href="/personas">Personas</NavItem>);
    const idle = screen.getByRole('link').className;

    rerender(
      <NavItem href="/personas" active>
        Personas
      </NavItem>
    );
    const active = screen.getByRole('link').className;

    expect(active).not.toBe(idle);
    // El activo tiene fondo propio; el inactivo solo lo tiene al pasar por encima.
    expect(active).toMatch(/bg-surface-sunken/);
    expect(idle).toMatch(/hover:bg-surface-sunken/);
  });

  /*
    El alto lo pone el CONTENEDOR y no el ítem, que es lo que permite que la columna de
    escritorio vaya en `density-compact` y el cajón del teléfono no.

    Este test pedía `min-h-touch` hasta el 19/9 y llevaba fallando desde que el componente
    pasó a `min-h-control`: el componente cambió de idea y el test se quedó con la anterior.
    Sigue siendo el mismo guardia —que el alto no se escriba a mano en el ítem— pero apuntando
    al token que de verdad decide. Los 44 px salen de `--density-control-height`, que por
    defecto son 2.75rem; bajarlos solo se permite donde el puntero es un ratón
    (`layout-y-componentes.md` §2b), y eso lo vigila quien pone `density-compact`, no esto.
  */
  it('toma el alto del contenedor y no lo fija a mano', () => {
    render(<NavItem href="/personas">Personas</NavItem>);

    const link = screen.getByRole('link');
    expect(link).toHaveClass('min-h-control');
    expect(link.className).not.toMatch(/\bh-\d/);
  });

  it('avisa a quien lo envuelve cuando se pulsa, desde el propio enlace', async () => {
    const onClick = jest.fn();
    render(
      <NavItem href="/personas" onClick={onClick}>
        Personas
      </NavItem>
    );

    await userEvent.click(screen.getByRole('link'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('también con teclado: por eso el manejador va en el enlace y no en un div', async () => {
    const onClick = jest.fn();
    render(
      <NavItem href="/personas" onClick={onClick}>
        Personas
      </NavItem>
    );

    screen.getByRole('link').focus();
    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lo bloqueado se queda en la pared, pero deja de ser un enlace', () => {
    render(
      <NavItem href="/cartera" locked lockedReason="Necesitas permiso de cartera">
        Cartera
      </NavItem>
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Cartera')).toBeInTheDocument();
    expect(screen.getByText('Necesitas permiso de cartera')).toBeInTheDocument();
  });
});
