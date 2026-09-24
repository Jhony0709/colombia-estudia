/**
 * Dropdown stories: la composición de HeroUI sobre Radix + `motion` (21/9).
 *
 * La función `play` es la prueba de interacción: abrir, ver las secciones y los ítems, elegir
 * uno y recibir su `itemKey` en `onAction`. Corre en Chromium (`@storybook/test-runner`),
 * donde el portal posicionado y la animación sí existen; jsdom no los observa (ver la
 * cabecera de `../menu/Menu.test.tsx`).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within, screen } from 'storybook/test';
import { Copy, FilePlus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from './Dropdown';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Molecules/Dropdown',
  component: DropdownMenu,
  parameters: {
    docs: {
      description: {
        component:
          '`Dropdown` › `DropdownTrigger` + `DropdownMenu` › (`DropdownSection` ›) `DropdownItem`. Radix pone el patrón *menu button* (teclado, foco, portal); `motion` pone la entrada con muelle y la salida en fundido, y las respeta `prefers-reduced-motion`. `color="danger"` tiñe el texto, no el bloque.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex justify-start p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Basico: Story = {
  args: { onAction: fn() },
  render: (args) => (
    <Dropdown>
      <DropdownTrigger>
        <Button variant="secondary">Acciones</Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Acciones del tema" align="start" onAction={args.onAction}>
        <DropdownSection title="Editar" showDivider>
          <DropdownItem itemKey="new" startContent={<FilePlus />} shortcut="⌘N">
            Nuevo tema
          </DropdownItem>
          <DropdownItem
            itemKey="copy"
            startContent={<Copy />}
            description="Con sus versiones publicadas"
          >
            Duplicar
          </DropdownItem>
          <DropdownItem itemKey="edit" startContent={<Pencil />} disabled>
            Editar
          </DropdownItem>
        </DropdownSection>
        <DropdownItem
          itemKey="delete"
          color="danger"
          startContent={<Trash2 />}
          description="No se puede deshacer"
        >
          Archivar
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Acciones' }));
    const menu = await screen.findByRole('menu', { name: 'Acciones del tema' });
    await expect(within(menu).getByText('Editar')).toBeInTheDocument();
    await expect(within(menu).getByText('Con sus versiones publicadas')).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Duplicar/ }));
    await expect(args.onAction).toHaveBeenCalledWith('copy');
  },
};

export const SinSecciones: Story = {
  render: () => (
    <Dropdown>
      <DropdownTrigger>
        <Button variant="quiet">Más</Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Más opciones" align="start">
        <DropdownItem itemKey="a">Subir</DropdownItem>
        <DropdownItem itemKey="b">Bajar</DropdownItem>
        <DropdownItem itemKey="c" color="danger">
          Quitar
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  ),
};
