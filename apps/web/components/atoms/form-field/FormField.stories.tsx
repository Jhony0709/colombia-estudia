/**
 * FormField stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormField, FormInput, FormSelect } from './FormField';

const meta: Meta<typeof FormField> = {
  title: 'Atoms/FormField',
  component: FormField,
  argTypes: {
    error: { control: 'text' },
    hint: { control: 'text' },
    required: { control: 'boolean' },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Form field wrapper with label, input, error, and hint. Uses context for ARIA associations.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  args: {
    label: 'Correo electrónico',
    name: 'email',
    children: <FormInput name="email" type="email" placeholder="tu@correo.com" />,
  },
};

export const WithHint: Story = {
  args: {
    label: 'Contraseña',
    name: 'password',
    hint: 'Mínimo 12 caracteres',
    children: <FormInput name="password" type="password" />,
  },
};

export const WithError: Story = {
  args: {
    label: 'Correo electrónico',
    name: 'email',
    error: 'Formato de correo inválido',
    children: <FormInput name="email" type="email" defaultValue="correo-malo" />,
  },
};

export const Required: Story = {
  args: {
    label: 'Nombre completo',
    name: 'fullName',
    required: true,
    children: <FormInput name="fullName" />,
  },
};

export const RequiredWithError: Story = {
  args: {
    label: 'Nombre completo',
    name: 'fullName',
    required: true,
    error: 'Este campo es obligatorio',
    children: <FormInput name="fullName" />,
  },
};

export const HintHiddenByError: Story = {
  args: {
    label: 'Contraseña',
    name: 'password',
    hint: 'Mínimo 12 caracteres',
    error: 'La contraseña es muy corta',
    children: <FormInput name="password" type="password" defaultValue="123" />,
  },
  parameters: {
    docs: {
      description: {
        story: 'When error is present, hint is hidden to avoid confusion.',
      },
    },
  },
};

export const DarkDefault: Story = {
  args: {
    label: 'Correo electrónico',
    name: 'email',
    children: <FormInput name="email" type="email" placeholder="tu@correo.com" />,
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
    label: 'Correo electrónico',
    name: 'email',
    error: 'Formato de correo inválido',
    children: <FormInput name="email" type="email" defaultValue="correo-malo" />,
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};

export const WithSelect: Story = {
  args: {
    label: 'Rol',
    name: 'rol',
    children: (
      <FormSelect name="rol" defaultValue="">
        <option value="">Cualquier rol</option>
        <option value="STUDENT">Estudiante</option>
        <option value="GUARDIAN">Acudiente</option>
      </FormSelect>
    ),
  },
};

export const SelectWithError: Story = {
  args: {
    label: 'Rol',
    name: 'rol',
    required: true,
    error: 'Elige un rol',
    children: (
      <FormSelect name="rol" defaultValue="">
        <option value="">Elige…</option>
        <option value="STUDENT">Estudiante</option>
      </FormSelect>
    ),
  },
};
