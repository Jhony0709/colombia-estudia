/**
 * Input stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './Input';
import { Label } from '../label';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  // In the product every control lives inside FormField with a visible <label>
  // (accesibilidad.md:45: never placeholder alone). Stories reproduce that: without it axe
  // fails the `label` rule on any story that has no placeholder (16/9, 8 stories).
  args: { id: 'input-story' },
  decorators: [
    (Story) => (
      <div className="space-y-1">
        <Label htmlFor="input-story">Correo electrónico</Label>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'tel', 'number', 'url'],
    },
    hasError: { control: 'boolean' },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Base text input with error state and minimum touch target.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Escribe aquí...',
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'tu@correo.com',
    type: 'email',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'juan@ejemplo.com',
    type: 'email',
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: 'correo-invalido',
    type: 'email',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'No editable',
  },
};

export const DarkDefault: Story = {
  args: {
    placeholder: 'Escribe aquí...',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkWithError: Story = {
  args: {
    hasError: true,
    defaultValue: 'correo-invalido',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
