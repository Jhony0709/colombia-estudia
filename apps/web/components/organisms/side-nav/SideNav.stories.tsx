/**
 * SideNav stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SideNav } from './SideNav';

const meta: Meta<typeof SideNav> = {
  title: 'Organisms/SideNav',
  component: SideNav,
  parameters: {
    /*
      La convención del repo (`AppHeader.stories.tsx:18`), que se me pasó al escribir esto: sin
      esto `usePathname()` devuelve `null` y la story no puede enseñar cuál es la página actual,
      que es media razón de ser del componente.
    */
    nextjs: { appDirectory: true, navigation: { pathname: '/personas' } },
    docs: {
      description: {
        component:
          'La navegación del área de staff: columna desde `lg` (CSS, sin JavaScript) y cajón por debajo. El cajón es Radix Dialog para no reimplementar peor lo que exige el patrón APG: foco atrapado, `Escape` cierra, el foco vuelve al disparador. Reduce el viewport de Storybook por debajo de `lg` para ver el cajón.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SideNav>;

const items = [
  { href: '/personas', label: 'Personas' },
  { href: '/cohortes', label: 'Cohortes' },
  { href: '/contenido', label: 'Contenido' },
  { href: '/admin/institucion', label: 'Institución' },
];

export const Default: Story = {
  args: {
    institutionName: 'Colombia Estudia',
    items,
    personName: 'Ana Gómez',
    theme: 'light' as const,
    unreadNotifications: 0,
  },
};

export const WithUnread: Story = {
  args: { ...Default.args, unreadNotifications: 3 },
};

/** Quien solo tiene una capacidad solo ve una puerta. */
export const SingleCapability: Story = {
  args: { ...Default.args, items: [items[2]!] },
};

export const Dark: Story = {
  args: Default.args,
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark min-h-screen">
        <Story />
      </div>
    ),
  ],
};
