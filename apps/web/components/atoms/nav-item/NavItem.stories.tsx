/**
 * NavItem stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavItem } from './NavItem';

const meta: Meta<typeof NavItem> = {
  title: 'Atoms/NavItem',
  component: NavItem,
  parameters: {
    docs: {
      description: {
        component:
          'Ir a otro sitio. Renderiza un `<a>`, así que se abre en otra pestaña y se copia; un `<button>` con `router.push` no hace ninguna de las dos. `hover` y `selected` son estados distintos y llevan tratamientos distintos.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-base w-64 p-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NavItem>;

export const Default: Story = {
  args: { href: '/personas', children: 'Personas' },
};

export const Active: Story = {
  args: { href: '/personas', children: 'Personas', active: true },
};

/** El contador va en texto: un punto de color no se lee en voz alta. */
export const WithCounter: Story = {
  args: {
    href: '/notificaciones',
    children: 'Notificaciones',
    trailing: <span className="type-caption text-text-muted">3</span>,
  },
};

/** Una puerta que no puedes abrir sigue en la pared, con su razón. */
export const Locked: Story = {
  args: {
    href: '/cartera',
    children: 'Cartera',
    locked: true,
    lockedReason: 'Necesitas permiso de cartera',
  },
};

export const Dark: Story = {
  args: { href: '/personas', children: 'Personas', active: true },
  decorators: [
    (Story) => (
      <div className="bg-surface-base dark w-64 p-2">
        <Story />
      </div>
    ),
  ],
};
