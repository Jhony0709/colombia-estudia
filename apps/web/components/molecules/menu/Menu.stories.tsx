/**
 * Menu stories.
 *
 * Las funciones `play` de este archivo son **las pruebas de interacción del componente**, y no
 * una demostración. Viven aquí y no en `Menu.test.tsx` porque corren en Chromium con
 * `@storybook/test-runner`, y lo que hay que comprobar —teclado, foco y un panel en un portal—
 * es justo lo que jsdom no sabe observar con un primitivo posicionado con Popper. El porqué,
 * medido, está en la cabecera de `Menu.test.tsx`.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Menu, MenuItem, MenuSeparator } from './Menu';

const LABEL = 'Acciones de la pregunta 2';

const meta: Meta<typeof Menu> = {
  title: 'Molecules/Menu',
  component: Menu,
  parameters: {
    docs: {
      description: {
        component:
          'Las acciones que no hacen falta siempre a la vista. Acciones frecuentes visibles, ocasionales bajo el `⋯`, destructivas nunca dominantes. Sobre Radix, que ya trae el patrón *menu button* de APG: flechas para recorrer, `Escape` para cerrar, el foco vuelve al disparador.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex justify-end p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Menu>;

const items = (
  <>
    <MenuItem onSelect={() => {}}>Subir</MenuItem>
    <MenuItem onSelect={() => {}}>Bajar</MenuItem>
    <MenuSeparator />
    <MenuItem destructive onSelect={() => {}}>
      Quitar
    </MenuItem>
  </>
);

export const Default: Story = {
  args: { label: LABEL, children: items },
};

/**
 * El menú se abre con el teclado y se recorre con las flechas: meter acciones detrás de un
 * `⋯` solo se justifica si siguen alcanzables sin ratón.
 */
export const OpensWithKeyboard: Story = {
  args: Default.args,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    // El panel va en un portal, fuera del canvas de la story.
    const portal = within(document.body);
    const trigger = canvas.getByRole('button', { name: LABEL });

    await step('abre con Enter desde el disparador enfocado', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await expect(await portal.findByRole('menuitem', { name: 'Subir' })).toBeInTheDocument();
    });

    await step('la flecha abajo mueve por las acciones', async () => {
      await userEvent.keyboard('{ArrowDown}');
      await expect(portal.getByRole('menuitem', { name: 'Bajar' })).toHaveFocus();
    });

    await step('Escape cierra y devuelve el foco al disparador', async () => {
      await userEvent.keyboard('{Escape}');
      await expect(portal.queryByRole('menuitem', { name: 'Subir' })).not.toBeInTheDocument();
      await expect(trigger).toHaveFocus();
    });
  },
};

/** Lo destructivo se tiñe en el texto y va al final, detrás de un separador. Nunca un bloque rojo. */
export const DestructiveIsNotDominant: Story = {
  args: Default.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const trigger = canvas.getByRole('button', { name: LABEL });

    await userEvent.click(trigger);

    const remove = await portal.findByRole('menuitem', { name: 'Quitar' });
    await expect(remove).toHaveClass('text-status-error-base');
    await expect(remove.className).not.toMatch(/bg-status-error/);

    // Se cierra al terminar: el barrido de axe corre después de la story, y una story que
    // acaba con el menú abierto examina un estado que no es el de reposo.
    await userEvent.keyboard('{Escape}');
  },
};

/** La primera pregunta no puede subir: la acción sigue ahí, apagada, y no se ejecuta. */
export const DisabledDoesNothing: Story = {
  args: {
    label: 'Acciones de la pregunta 1',
    children: (
      <>
        <MenuItem disabled onSelect={() => {}}>
          Subir
        </MenuItem>
        <MenuItem onSelect={() => {}}>Bajar</MenuItem>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const portal = within(document.body);
    const trigger = canvas.getByRole('button', { name: 'Acciones de la pregunta 1' });

    await userEvent.click(trigger);

    const up = await portal.findByRole('menuitem', { name: 'Subir' });
    await expect(up).toHaveAttribute('data-disabled');
    // Sigue en el menú: una acción que desaparece cuando no se puede usar hace creer que no existe.
    await expect(up).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
  },
};

export const Dark: Story = {
  args: Default.args,
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark flex justify-end p-8">
        <Story />
      </div>
    ),
  ],
};
