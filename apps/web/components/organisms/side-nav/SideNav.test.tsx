/** @jest-environment jsdom */
/**
 * Tests for SideNav.
 * SSOT: reference/03-ui/layout-y-componentes.md §5, PRODUCT_DECISIONS.md 2026-09-18.
 *
 * Lo que se prueba aquí es lo que costó tomar la decisión: en el teléfono la navegación pasa
 * a estar detrás de un botón, y un cajón que no se cierre con `Escape` o que no devuelva el
 * foco es peor que la barra que sustituye.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNav } from './SideNav';
import { TooltipProvider } from '@/components/atoms/tooltip';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const items = [
  { href: '/personas', label: 'Personas' },
  { href: '/cohortes', label: 'Cohortes' },
];

function renderNav(unread = 0) {
  return render(
    <TooltipProvider>
      <SideNav
        institutionName="Colombia Estudia"
        items={items}
        personName="Ana Gómez"
        unreadNotifications={unread}
        theme="light"
      />
    </TooltipProvider>
  );
}

describe('SideNav', () => {
  beforeEach(() => mockPathname.mockReturnValue('/personas'));

  it('marca la página actual con aria-current y no solo con color', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cohortes' })).not.toHaveAttribute('aria-current');
  });

  it('trata una ficha como parte de su sección', () => {
    mockPathname.mockReturnValue('/personas/abc123');
    renderNav();

    expect(screen.getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
  });

  it('enseña solo los destinos que se le dan', () => {
    render(
      <TooltipProvider>
        <SideNav
          institutionName="Colombia Estudia"
          items={[items[1]!]}
          personName="Ana Gómez"
          theme="light"
        />
      </TooltipProvider>
    );

    expect(screen.queryByRole('link', { name: 'Personas' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cohortes' })).toBeInTheDocument();
  });

  it('cuenta los avisos en texto: un punto de color no se lee en voz alta', () => {
    renderNav(3);

    expect(screen.getByRole('link', { name: /Notificaciones \(3 sin leer\)/ })).toBeInTheDocument();
  });

  describe('el cajón del teléfono', () => {
    it('no está abierto de entrada', () => {
      renderNav();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('se abre desde el botón y lleva dentro los mismos destinos', async () => {
      renderNav();

      await userEvent.click(screen.getByRole('button', { name: 'Abrir la navegación' }));

      const drawer = screen.getByRole('dialog');
      expect(within(drawer).getByRole('link', { name: 'Personas' })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: 'Cohortes' })).toBeInTheDocument();
    });

    it('se cierra con Escape y devuelve el foco al botón que lo abrió', async () => {
      renderNav();

      const trigger = screen.getByRole('button', { name: 'Abrir la navegación' });
      await userEvent.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('pulsar un destino lo cierra, incluso si es la página en la que ya estás', async () => {
      // `usePathname` no cambia en este caso, así que el efecto sobre la ruta no se entera:
      // lo cierra el manejador del propio enlace. Esto es lo que se rompió al quitar el
      // `onClick` del `div`, y por eso está aquí.
      renderNav();

      await userEvent.click(screen.getByRole('button', { name: 'Abrir la navegación' }));
      const drawer = screen.getByRole('dialog');

      await userEvent.click(within(drawer).getByRole('link', { name: 'Personas' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
