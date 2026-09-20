/**
 * Card stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Atoms/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'Un panel con nombre propio. Agrupa con **borde**: en modo oscuro una sombra apenas se ve y la agrupación se perdería al cambiar de tema. Desde el 18/9 lleva además `elevation-resting`, una sombra muy baja que la despega del lienzo en claro — refuerzo, no mecanismo. No es para listas —eso son filas— ni se anida dentro de otra Card.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    title: 'Video',
    children: <p className="type-body text-text">vimeo.com/737436102 · 11 min</p>,
  },
};

export const WithDescriptionAndAction: Story = {
  args: {
    title: 'Pregunta 1',
    description: 'Una sola respuesta · 20 puntos',
    action: (
      <button type="button" className="type-label text-text-link underline">
        Quitar
      </button>
    ),
    children: <p className="type-body text-text">¿Qué es la inteligencia financiera?</p>,
  },
};

/** Sin título no se anuncia como región: agrupa a la vista y nada más. */
export const Untitled: Story = {
  args: {
    children: <p className="type-body text-text">Un agrupador visual, sin nombre.</p>,
  },
};

export const Dark: Story = {
  args: {
    title: 'Video',
    children: <p className="type-body text-text">El borde sigue agrupando; una sombra no.</p>,
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-canvas dark p-4">
        <Story />
      </div>
    ),
  ],
};
