/** @jest-environment jsdom */
/**
 * Visor de imágenes (19/11): cada imagen del contenido pasa a ser un botón que la abre a
 * pantalla completa, con su pie como título y el texto alternativo como descripción.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VisorImagen } from './VisorImagen';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

beforeEach(() => {
  document.body.innerHTML = `
    <article class="contenido">
      <figure class="figura"><img src="https://x.supabase.co/celula.webp" alt="Célula animal y vegetal con sus partes"><figcaption>Las dos células</figcaption></figure>
      <p><img src="https://x.supabase.co/suelta.webp" alt="Pizza en cuatro porciones"></p>
    </article>`;
});

it('envuelve cada imagen en un botón con nombre, una sola vez', () => {
  const { rerender } = render(<VisorImagen watch="a" />);
  rerender(<VisorImagen watch="b" />);
  const buttons = document.querySelectorAll('.contenido .visor-abrir');
  expect(buttons).toHaveLength(2);
  expect(buttons[0]!.getAttribute('aria-label')).toBe(
    'open: Célula animal y vegetal con sus partes'
  );
  expect(document.querySelectorAll('.visor-abrir .visor-abrir')).toHaveLength(0);
});

it('abre la imagen con su pie y su texto alternativo, acerca y se cierra', async () => {
  render(<VisorImagen />);
  fireEvent.click(document.querySelector('.contenido .visor-abrir img')!);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Las dos células');
  expect(dialog).toHaveTextContent('Célula animal y vegetal con sus partes');
  expect(dialog.querySelector('img')!.getAttribute('src')).toBe(
    'https://x.supabase.co/celula.webp'
  );
  expect(dialog.querySelector('output')).toHaveTextContent('100 %');
  fireEvent.click(screen.getByText('zoomIn').closest('button')!);
  expect(dialog.querySelector('output')).toHaveTextContent('150 %');
  fireEvent.keyDown(dialog.querySelector('.visor-lienzo')!, { key: '0' });
  expect(dialog.querySelector('output')).toHaveTextContent('100 %');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() =>
    expect(document.activeElement).toBe(document.querySelector('.contenido .visor-abrir'))
  );
});

it('sin pie, el título es el texto alternativo', () => {
  render(<VisorImagen />);
  fireEvent.click(document.querySelectorAll('.contenido .visor-abrir')[1]!);
  expect(screen.getByRole('dialog')).toHaveTextContent('Pizza en cuatro porciones');
});
