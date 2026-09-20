/**
 * DataTable stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from './DataTable';
import { EmptyState } from '../empty-state';

interface Row {
  id: string;
  name: string;
  cohort: string;
  installments: number;
}

const rows: Row[] = [
  { id: '1', name: 'Ruiz Peña, Ana María', cohort: '2026-2', installments: 6 },
  { id: '2', name: 'Gómez Díaz, Carlos', cohort: '2026-2', installments: 12 },
];

const columns = [
  { key: 'name', header: 'Nombre', cell: (row: Row) => row.name },
  { key: 'cohort', header: 'Cohorte', cell: (row: Row) => row.cohort },
  { key: 'installments', header: 'Cuotas', numeric: true, cell: (row: Row) => row.installments },
];

const meta: Meta<typeof DataTable<Row>> = {
  title: 'Molecules/DataTable',
  component: DataTable<Row>,
  parameters: {
    docs: {
      description: {
        component:
          'Una sola tabla para toda el área de staff: caption real, encabezados con scope y contenedor con scroll propio para el reflow a 320 px.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataTable<Row>>;

export const Default: Story = {
  args: {
    caption: 'Matrículas de la cohorte, con su estado y hasta cuándo tienen acceso.',
    rows,
    columns,
    rowKey: (row: Row) => row.id,
    empty: <EmptyState title="Sin matrículas." />,
  },
};

export const Empty: Story = {
  args: {
    caption: 'Matrículas de la cohorte.',
    rows: [],
    columns,
    rowKey: (row: Row) => row.id,
    empty: (
      <EmptyState
        title="Aún no hay nadie matriculado."
        description="Matricula a la primera persona."
      />
    ),
  },
};
