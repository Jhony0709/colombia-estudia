/** @jest-environment jsdom */
/**
 * Tests for the Page template.
 * SSOT: DESIGN.md §Tipografía, plan/11-ux.md:10
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Page, PageHeader, PageSection } from './Page';

describe('PageHeader', () => {
  it('renders the title as the page heading, focusable for the route-change focus move', () => {
    render(<PageHeader title="Personas" />);

    const heading = screen.getByRole('heading', { level: 1, name: 'Personas' });
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('shows the overline and description when given', () => {
    render(<PageHeader overline="Operaciones" title="Personas" description="Quién está." />);

    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByText('Quién está.')).toBeInTheDocument();
  });
});

describe('PageSection', () => {
  it('names its own region, so the section is navigable by landmark', () => {
    render(
      <PageSection title="Resultados">
        <p>contenido</p>
      </PageSection>
    );

    expect(screen.getByRole('region', { name: 'Resultados' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Resultados' })).toBeInTheDocument();
  });
});

describe('Page', () => {
  it('wraps its children', () => {
    render(
      <Page>
        <p>contenido</p>
      </Page>
    );

    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
