/**
 * Button stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'quiet'],
    },
    size: {
      control: 'select',
      options: ['default', 'lg'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Primary button component with three variants and accessible loading state.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Continuar',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Cancelar',
    variant: 'secondary',
  },
};

export const Quiet: Story = {
  args: {
    children: 'Ver más',
    variant: 'quiet',
  },
};

export const Large: Story = {
  args: {
    children: 'Inscribirse ahora',
    size: 'lg',
  },
};

export const Loading: Story = {
  args: {
    children: 'Guardando',
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    children: 'No disponible',
    disabled: true,
  },
};

export const AsLink: Story = {
  args: {
    asChild: true,
    children: <a href="/lesson/1">Ir al tema</a>,
  },
};

// Dark mode stories
export const DarkPrimary: Story = {
  args: {
    children: 'Continuar',
    variant: 'primary',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkSecondary: Story = {
  args: {
    children: 'Cancelar',
    variant: 'secondary',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkLoading: Story = {
  args: {
    children: 'Guardando',
    loading: true,
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
