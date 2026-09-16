/**
 * Alert stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Atoms/Alert',
  component: Alert,
  argTypes: {
    severity: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Alert component with severity-based styling. Error uses role="alert", others use role="status".',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Success: Story = {
  args: {
    severity: 'success',
    children: 'Los cambios se guardaron correctamente.',
  },
};

export const Warning: Story = {
  args: {
    severity: 'warning',
    children: 'Tu sesión expirará pronto. Guarda tus cambios.',
  },
};

export const Error: Story = {
  args: {
    severity: 'error',
    children: 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.',
  },
};

export const Info: Story = {
  args: {
    severity: 'info',
    children: 'Puedes editar esta información en cualquier momento.',
  },
};

export const LongContent: Story = {
  args: {
    severity: 'info',
    children:
      'Este es un mensaje más largo que puede ocupar varias líneas. El texto se ajusta automáticamente y el icono permanece alineado arriba.',
  },
};

export const DarkSuccess: Story = {
  args: {
    severity: 'success',
    children: 'Los cambios se guardaron correctamente.',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkWarning: Story = {
  args: {
    severity: 'warning',
    children: 'Tu sesión expirará pronto.',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkError: Story = {
  args: {
    severity: 'error',
    children: 'No se pudo guardar.',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkInfo: Story = {
  args: {
    severity: 'info',
    children: 'Información adicional.',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
