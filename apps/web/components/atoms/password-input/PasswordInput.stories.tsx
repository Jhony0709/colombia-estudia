/**
 * PasswordInput stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PasswordInput } from './PasswordInput';
import { Label } from '../label';

const meta: Meta<typeof PasswordInput> = {
  title: 'Atoms/PasswordInput',
  component: PasswordInput,
  // In the product every control lives inside FormField with a visible <label>
  // (accesibilidad.md:45: never placeholder alone). Stories reproduce that: without it axe
  // fails the `label` rule on any story that has no placeholder (16/9, 8 stories).
  args: { id: 'passwordinput-story' },
  decorators: [
    (Story) => (
      <div className="space-y-1">
        <Label htmlFor="passwordinput-story">Contraseña</Label>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    autoComplete: {
      control: 'select',
      options: ['current-password', 'new-password'],
    },
    hasError: { control: 'boolean' },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  parameters: {
    docs: {
      description: {
        component: 'Password input with show/hide toggle. Supports pasting (NIST 800-63B).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PasswordInput>;

export const Default: Story = {
  args: {
    placeholder: 'Ingresa tu contraseña',
  },
};

export const NewPassword: Story = {
  args: {
    autoComplete: 'new-password',
    placeholder: 'Crea una contraseña',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'mi-contraseña-segura',
  },
};

export const WithError: Story = {
  args: {
    hasError: true,
    defaultValue: 'corta',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'no-editable',
  },
};

export const DarkDefault: Story = {
  args: {
    placeholder: 'Ingresa tu contraseña',
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
    defaultValue: 'corta',
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
