/** @jest-environment jsdom */
/**
 * Tests for DataTable.
 * SSOT: plan/11-ux.md:56, DESIGN.md §Espaciado
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';

interface Row {
  id: string;
  name: string;
}

const columns = [{ key: 'name', header: 'Nombre', cell: (row: Row) => row.name }];

describe('DataTable', () => {
  it('describes itself with a caption instead of leaving the table unnamed', () => {
    render(
      <DataTable<Row>
        caption="Personas de la institución"
        rows={[{ id: '1', name: 'Ana' }]}
        columns={columns}
        rowKey={(row) => row.id}
        empty={<p>vacío</p>}
      />
    );

    expect(screen.getByRole('table', { name: 'Personas de la institución' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
  });

  it('makes the scroll container reachable by keyboard and gives it a name', () => {
    render(
      <DataTable<Row>
        caption="Personas de la institución"
        rows={[{ id: '1', name: 'Ana' }]}
        columns={columns}
        rowKey={(row) => row.id}
        empty={<p>vacío</p>}
      />
    );

    // A scrollable region only a mouse can reach is not reachable (WCAG 2.1.1).
    expect(screen.getByRole('region', { name: 'Personas de la institución' })).toHaveAttribute(
      'tabindex',
      '0'
    );
  });

  it('renders the empty state instead of an empty grid', () => {
    render(
      <DataTable<Row>
        caption="Personas"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.id}
        empty={<p>Aún no hay personas.</p>}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Aún no hay personas.')).toBeInTheDocument();
  });
});
