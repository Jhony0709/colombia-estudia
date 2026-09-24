/** @jest-environment jsdom */
/**
 * StatusBadge: un dominio → una palabra y un tono, decididos aquí y no en cada pantalla.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

const MESSAGES: Record<string, string> = {
  'account.OVERDUE': 'Con cuota vencida',
  'cohort.OPEN': 'Abierta',
  'submission.RETURNED': 'Devuelta',
};

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => MESSAGES[key] ?? key;
    t.has = (key: string) => key in MESSAGES;
    return t;
  },
}));

describe('StatusBadge', () => {
  it('pone la palabra del dominio y el tono que le corresponde', () => {
    render(<StatusBadge domain="account" status="OVERDUE" />);
    const badge = screen.getByText('Con cuota vencida');
    expect(badge).toHaveClass('text-status-error-base');
  });

  it('la misma enumeración se lee igual en cualquier pantalla', () => {
    render(<StatusBadge domain="cohort" status="OPEN" />);
    expect(screen.getByText('Abierta')).toHaveClass('text-status-success-base');
  });

  it('una entrega devuelta va en singular, no con la etiqueta del filtro', () => {
    render(<StatusBadge domain="submission" status="RETURNED" />);
    expect(screen.getByText('Devuelta')).toHaveClass('text-status-warning-base');
  });

  it('un estado que la tabla no conoce sale en neutro y con la clave, sin romper', () => {
    render(<StatusBadge domain="cohort" status="SUSPENDED" />);
    expect(screen.getByText('SUSPENDED')).toHaveClass('text-text-muted');
  });
});
