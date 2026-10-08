/** @jest-environment jsdom */
/**
 * El recorrido del formulario conversacional (6/10, experiencia-colombia-estudia §4).
 */

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConversationalForm, type ConversationStep } from './ConversationalForm';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [name, setName] = useState('');
  const steps: ConversationStep[] = [
    {
      id: 'name',
      section: 'Sobre ti',
      prompt: '¿Cómo te llamas?',
      answer: name,
      validate: () => (name ? null : 'Falta el nombre'),
      field: () => (
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ),
    },
    {
      id: 'ok',
      section: 'Cuenta',
      prompt: '¿Aceptas?',
      answer: 'Acepto',
      kind: 'choice',
      field: ({ advance }) => (
        <button type="button" onClick={advance}>
          Acepto
        </button>
      ),
    },
  ];
  return (
    <ConversationalForm
      steps={steps}
      onSubmit={onSubmit}
      finale={{
        section: 'Listo',
        prompt: 'Todo listo',
        content: <button type="submit">Crear</button>,
      }}
    />
  );
}

describe('ConversationalForm', () => {
  it('no avanza sin respuesta válida y lo dice', () => {
    render(<Harness onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Falta el nombre');
  });

  // La salida del paso es una animación (aunque dure 0): lo siguiente aparece al terminar.
  it('lo respondido queda como píldora editable y la opción avanza sola hasta el final', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(await screen.findByRole('group', { name: '¿Aceptas?' })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /editLabel:¿Cómo te llamas\?,Ana/ })
    ).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Acepto' }));
    expect(await screen.findByRole('heading', { name: 'Todo listo' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Crear' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Editar vuelve a esa pregunta y, al confirmar, de vuelta al final.
    fireEvent.click(screen.getByRole('button', { name: /editLabel:¿Cómo te llamas\?/ }));
    expect(await screen.findByRole('group', { name: '¿Cómo te llamas?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(await screen.findByRole('heading', { name: 'Todo listo' })).toBeInTheDocument();
  });
});
