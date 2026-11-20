/** @jest-environment jsdom */
/**
 * Escenas (14/11): numera los elementos, espera a que la escena entre en vista para animarla y
 * con movimiento reducido no toca nada.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { Escenas } from './Escenas';

let observed: Element[] = [];
let trigger: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void = () => {};

beforeEach(() => {
  observed = [];
  document.body.innerHTML = `
    <article class="contenido">
      <figure class="escena escena-ciclo"><figcaption>El ciclo</figcaption>
        <ul><li>Uno</li><li>Dos</li><li>Tres</li></ul>
      </figure>
    </article>`;
  delete document.documentElement.dataset.motion;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    constructor(cb: typeof trigger) {
      trigger = cb;
    }
    observe(el: Element) {
      observed.push(el);
    }
    unobserve() {}
    disconnect() {}
  };
});

it('numera los elementos y la anima al entrar en vista', () => {
  render(<Escenas />);
  const escena = document.querySelector<HTMLElement>('.escena')!;
  const items = escena.querySelectorAll<HTMLElement>('li');
  expect(items[2]!.style.getPropertyValue('--i')).toBe('2');
  expect(escena.style.getPropertyValue('--n')).toBe('3');
  expect(escena.dataset.escena).toBe('pendiente');
  trigger([{ isIntersecting: true, target: escena }]);
  expect(escena.dataset.escena).toBe('viva');
});

it('numera también los puntos de cada sublista (19/11)', () => {
  document.querySelector('.escena ul')!.innerHTML =
    '<li>A<ul><li>a1</li><li>a2</li></ul></li><li>B<ul><li>b1</li></ul></li>';
  render(<Escenas />);
  const subs = [...document.querySelectorAll<HTMLElement>('.escena li li')];
  expect(subs.map((li) => li.style.getPropertyValue('--j'))).toEqual(['0', '1', '0']);
  expect(document.querySelector<HTMLElement>('.escena')!.style.getPropertyValue('--n')).toBe('2');
});

it('con movimiento reducido la deja quieta', () => {
  document.documentElement.dataset.motion = 'reduced';
  render(<Escenas />);
  expect(document.querySelector<HTMLElement>('.escena')!.dataset.escena).toBeUndefined();
  expect(observed).toHaveLength(0);
});
