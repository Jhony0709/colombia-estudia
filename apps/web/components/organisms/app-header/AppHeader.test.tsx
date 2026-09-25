/** @jest-environment jsdom */
/**
 * Tests for AppHeader.
 * SSOT: DESIGN.md §Color semántico (el color nunca carga solo el significado)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppHeader } from './AppHeader';

const mockPathname = jest.fn();

// `LogoutDialog` (23/9) trae `Button`, que lee `next-intl` para el texto de carga; el paquete
// es ESM y Jest no lo transforma, así que se sustituye como en `Button.test.tsx`.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const items = [
  { href: '/personas', label: 'Personas' },
  { href: '/cohortes', label: 'Cohortes' },
];

describe('AppHeader', () => {
  beforeEach(() => mockPathname.mockReturnValue('/personas'));

  it('marks the current page with aria-current, not only with a colour', () => {
    render(<AppHeader institutionName="Colombia Estudia" items={items} personName="Ana" />);

    expect(screen.getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cohortes' })).not.toHaveAttribute('aria-current');
  });

  it('treats a detail page as being inside its section', () => {
    mockPathname.mockReturnValue('/personas/abc123');

    render(<AppHeader institutionName="Colombia Estudia" items={items} personName="Ana" />);

    expect(screen.getByRole('link', { name: 'Personas' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows only the links it was given: a door you cannot open is not on the wall', () => {
    render(
      <AppHeader
        institutionName="Colombia Estudia"
        items={[{ href: '/cohortes', label: 'Cohortes' }]}
        personName="Ana"
      />
    );

    expect(screen.queryByRole('link', { name: 'Personas' })).not.toBeInTheDocument();
  });

  // plan/11-ux.md:79 pide "campana con contador en texto". Un punto de color no se lee en
  // voz alta y no dice cuántos son.
  it('pone el número de avisos sin leer en el texto del enlace', () => {
    render(
      <AppHeader
        institutionName="Colombia Estudia"
        items={items}
        personName="Ana"
        unreadNotifications={3}
      />
    );

    expect(screen.getByRole('link', { name: 'Notificaciones (3 sin leer)' })).toHaveAttribute(
      'href',
      '/notificaciones'
    );
  });

  it('sin avisos, el enlace no anuncia un cero', () => {
    render(<AppHeader institutionName="Colombia Estudia" items={items} personName="Ana" />);

    expect(screen.getByRole('link', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('names the navigation landmark and offers a way out', () => {
    render(<AppHeader institutionName="Colombia Estudia" items={items} personName="Ana" />);

    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    // Desde el 23/9 «Cerrar sesión» es un botón que abre un diálogo, no un enlace.
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
