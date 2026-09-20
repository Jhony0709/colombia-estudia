/**
 * Badge stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  parameters: {
    docs: {
      description: {
        component:
          'Un estado en forma de píldora. La **palabra** es el estado; el color solo lo hace visible de lejos, igual que el contador de avisos va en texto y no en un punto rojo. Las cinco variantes tienen su par de contraste en el contrato de tokens, no solo medido una vez.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Borrador: Story = {
  args: { variant: 'neutral', children: 'Borrador (v1)' },
};

export const Publicado: Story = {
  args: { variant: 'success', children: 'Publicado (v2)' },
};

export const Todas: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="neutral">Sin publicar</Badge>
      <Badge variant="info">En revisión</Badge>
      <Badge variant="success">Publicado</Badge>
      <Badge variant="warning">Caduca pronto</Badge>
      <Badge variant="error">Bloqueado</Badge>
    </div>
  ),
};
