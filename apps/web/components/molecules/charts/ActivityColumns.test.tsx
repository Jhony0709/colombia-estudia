/** @jest-environment jsdom */
/**
 * «Tu ritmo» (4/10): una sola parada de tabulador, flechas entre días, y el día dice su cifra
 * al lector de pantalla y en el tooltip, igual con teclado que con puntero (skill de dataviz).
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActivityColumns, type ActivityDay } from './ActivityColumns';

const days: ActivityDay[] = [
  {
    date: '2026-10-02',
    steps: 3,
    short: 'V',
    description: '3 pasos · viernes, 2 de octubre',
    today: false,
  },
  {
    date: '2026-10-03',
    steps: 0,
    short: 'S',
    description: 'Sin pasos · sábado, 3 de octubre',
    today: false,
  },
  { date: '2026-10-04', steps: 1, short: 'Hoy', description: '1 paso · hoy', today: true },
];

describe('ActivityColumns', () => {
  it('es una lista con nombre y un solo día enfocable: hoy', () => {
    render(<ActivityColumns days={days} label="Pasos completados por día" />);
    const list = screen.getByRole('list', { name: 'Pasos completados por día' });
    const items = Array.from(list.querySelectorAll('li'));
    expect(items.filter((li) => li.tabIndex === 0)).toHaveLength(1);
    expect(items[2]).toHaveAttribute('tabindex', '0');
  });

  it('cada día se lee entero, con su cifra', () => {
    render(<ActivityColumns days={days} label="Pasos" />);
    expect(screen.getAllByText('3 pasos · viernes, 2 de octubre').length).toBeGreaterThan(0);
  });

  it('las flechas mueven el foco y el tooltip sigue al foco', () => {
    render(<ActivityColumns days={days} label="Pasos" />);
    const items = Array.from(screen.getByRole('list').querySelectorAll('li'));
    items[2]!.focus();
    fireEvent.keyDown(items[2]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items[1]);
    expect(items[1]).toHaveAttribute('tabindex', '0');
    const tip = items[1]!.querySelector('span[aria-hidden="true"]');
    expect(tip).toHaveClass('opacity-100');
    fireEvent.keyDown(items[1]!, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('la cifra directa va solo en el máximo', () => {
    render(<ActivityColumns days={days} label="Pasos" />);
    const items = Array.from(screen.getByRole('list').querySelectorAll('li'));
    expect(items[0]!.textContent).toContain('3V');
    expect(items[2]!.textContent).not.toMatch(/\b1Hoy/);
  });
});
