/**
 * EmptyState stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyState } from './EmptyState';
import { Button } from '../../atoms/button';

const meta: Meta<typeof EmptyState> = {
  title: 'Molecules/EmptyState',
  component: EmptyState,
  parameters: {
    docs: {
      description: {
        component:
          'Nunca una pantalla en blanco: qué no hay, qué hacer y a quién escribir (plan/11-ux.md).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'Aún no hay cohortes.',
    description: 'Una cohorte necesita un programa; los programas se crean en la institución.',
    supportEmail: 'soporte@colombiaestudia.co',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Aún no hay nadie matriculado en esta cohorte.',
    description: 'Matricula a la primera persona o usa el importador.',
    action: <Button variant="secondary">Matricular</Button>,
    supportEmail: 'soporte@colombiaestudia.co',
  },
};

export const Minimal: Story = {
  args: { title: 'Ninguna persona coincide con el filtro.' },
};
