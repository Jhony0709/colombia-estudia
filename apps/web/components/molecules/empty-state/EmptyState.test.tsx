/** @jest-environment jsdom */
/**
 * Tests for EmptyState.
 * SSOT: plan/11-ux.md:13-14
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows what is missing and what to do', () => {
    render(<EmptyState title="Aún no hay cohortes." description="Crea la primera." />);

    expect(screen.getByText('Aún no hay cohortes.')).toBeInTheDocument();
    expect(screen.getByText('Crea la primera.')).toBeInTheDocument();
  });

  it('offers the institution support address as a way out', () => {
    render(<EmptyState title="Sin datos" supportEmail="soporte@colombiaestudia.co" />);

    expect(screen.getByRole('link', { name: 'soporte@colombiaestudia.co' })).toHaveAttribute(
      'href',
      'mailto:soporte@colombiaestudia.co'
    );
  });

  it('does not invent a contact when there is none', () => {
    render(<EmptyState title="Sin datos" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
