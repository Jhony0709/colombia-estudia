/**
 * AppHeader stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AppHeader } from './AppHeader';

const items = [
  { href: '/personas', label: 'Personas' },
  { href: '/cohortes', label: 'Cohortes' },
  { href: '/admin/institucion', label: 'Institución' },
];

const meta: Meta<typeof AppHeader> = {
  title: 'Organisms/AppHeader',
  component: AppHeader,
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/personas' } },
    docs: {
      description: {
        component:
          'La única chrome del área de staff. La página actual se marca con `aria-current` y subrayado: el color nunca carga solo el significado.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AppHeader>;

export const Default: Story = {
  args: { institutionName: 'Colombia Estudia', items, personName: 'Jhonny Quiñones' },
};

export const OperationsOnly: Story = {
  args: {
    institutionName: 'Colombia Estudia',
    items: items.slice(0, 2),
    personName: 'Marta Peña',
  },
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/cohortes' } } },
};
