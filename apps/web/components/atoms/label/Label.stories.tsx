/**
 * Label stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './Label';

const meta: Meta<typeof Label> = {
  title: 'Atoms/Label',
  component: Label,
  argTypes: {
    required: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Accessible label for form controls. Use htmlFor to associate with inputs.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: 'Correo electrónico',
    htmlFor: 'email',
  },
};

export const Required: Story = {
  args: {
    children: 'Contraseña',
    htmlFor: 'password',
    required: true,
  },
};

export const WithInput: Story = {
  render: () => (
    <div className="space-y-1">
      <Label htmlFor="name-example">Nombre completo</Label>
      <input
        id="name-example"
        type="text"
        className="rounded-control border-border bg-surface-sunken w-full border px-3 py-2"
      />
    </div>
  ),
};

export const DarkDefault: Story = {
  args: {
    children: 'Correo electrónico',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkRequired: Story = {
  args: {
    children: 'Contraseña',
    required: true,
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
