/**
 * Page template stories.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Page, PageHeader, PageSection } from './Page';
import { Button } from '../../atoms/button';

const meta: Meta<typeof Page> = {
  title: 'Templates/Page',
  component: Page,
  parameters: {
    docs: {
      description: {
        component:
          'El marco de toda pantalla de staff: `display` para el título de área, `subheading` para las secciones, y un único hueco para la acción principal.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Page>;

export const Default: Story = {
  render: () => (
    <Page>
      <PageHeader
        overline="Operaciones"
        title="Personas"
        description="Quién está en la institución, con qué rol y en qué punto de su invitación."
        action={<Button variant="secondary">Exportar CSV</Button>}
      />
      <PageSection title="Resultados" description="12 personas">
        <p className="type-body text-text">Contenido de la sección.</p>
      </PageSection>
    </Page>
  ),
};

export const WithoutAction: Story = {
  render: () => (
    <Page>
      <PageHeader overline="Administración" title="Institución" />
      <PageSection title="Marca y contacto">
        <p className="type-body text-text">Contenido de la sección.</p>
      </PageSection>
    </Page>
  ),
};
