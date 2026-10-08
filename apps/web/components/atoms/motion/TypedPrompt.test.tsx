/** @jest-environment jsdom */
/**
 * El tecleo nunca esconde la pregunta al lector de pantalla (6/10, experiencia §4).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TypedPrompt } from './TypedPrompt';

const TEXT = '¿Cómo te llamas?';

describe('TypedPrompt', () => {
  it('el encabezado se llama con la frase entera desde el primer render', () => {
    render(<TypedPrompt text={TEXT} />);
    expect(screen.getByRole('heading', { name: TEXT })).toBeInTheDocument();
  });

  it('sin animar, la frase visible está completa y avisa que terminó', () => {
    const onDone = jest.fn();
    const { container } = render(<TypedPrompt text={TEXT} animate={false} onDone={onDone} />);
    expect(container.querySelector('span.absolute')).toHaveTextContent(TEXT);
    expect(container.querySelector('.typed-caret')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
