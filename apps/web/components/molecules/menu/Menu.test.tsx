/** @jest-environment jsdom */
/**
 * Tests for Menu.
 * SSOT: reference/03-ui/layout-y-componentes.md §5 y §7.
 *
 * **Aquí solo está lo que jsdom puede observar de verdad.** Abrir el menú, recorrerlo con el
 * teclado, cerrarlo con `Escape` y comprobar que el foco vuelve se prueban en `Menu.stories.tsx`
 * con una función `play`, que corre en Chromium a través de `@storybook/test-runner`.
 *
 * No es una excusa: es una medición. `DropdownMenu` se coloca con Popper/floating-ui, y en
 * jsdom el ciclo medir → recolocar → medir no converge. Cinco tests agotaban su tiempo y la
 * suite tardaba **147 segundos**; probé a añadir `ResizeObserver` y `DOMRect` al entorno y el
 * resultado fue idéntico hasta la décima de segundo, así que el polyfill se quitó en vez de
 * quedarse como adorno. `Dialog` no lo sufre porque no se posiciona, y por eso los tests de
 * `SideNav` sí pasan en jest.
 *
 * Un test que tarda 30 segundos en decir la verdad es peor que uno que no existe, porque
 * además se acaba desactivando.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Menu, MenuItem, MenuSeparator } from './Menu';
import { TooltipProvider } from '@/components/atoms/tooltip';

function renderMenu() {
  // Como en la app: layout.tsx envuelve todo en TooltipProvider y el disparador lleva tooltip.
  render(
    <TooltipProvider>
      <Menu label="Acciones de la pregunta 2">
        <MenuItem onSelect={() => {}}>Subir</MenuItem>
        <MenuSeparator />
        <MenuItem destructive onSelect={() => {}}>
          Quitar
        </MenuItem>
      </Menu>
    </TooltipProvider>
  );
}

describe('Menu', () => {
  it('el disparador dice de qué es: en una lista habría diez llamados igual', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Acciones de la pregunta 2' })).toBeInTheDocument();
  });

  it('no enseña las acciones hasta que se abre', () => {
    renderMenu();
    expect(screen.queryByRole('menuitem', { name: 'Quitar' })).not.toBeInTheDocument();
  });

  it('el disparador cumple el objetivo presionable mínimo', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Acciones de la pregunta 2' });
    expect(trigger).toHaveClass('min-h-touch');
    expect(trigger).toHaveClass('min-w-touch');
  });
});
