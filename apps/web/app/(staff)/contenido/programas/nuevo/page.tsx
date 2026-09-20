/**
 * Alta de un programa.
 * SSOT: reference/01-routing/routes.md, plan/06-cohortes-y-personas.md:19-22.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireCapability } from '@/lib/authz/with-capability';
import { Page, PageHeader } from '@/components/templates/page';
import { NewProgram } from './new-program';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Nuevo programa' };

export default async function NewProgramPage() {
  await requireCapability('institution.manage');
  const t = await getTranslations('admin.curriculum');

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('programs'), href: '/contenido/programas' },
              { label: tc('new') },
            ]}
          />
        }
        title={t('newProgram')}
        description={t('newProgramHint')}
      />

      <NewProgram />
    </Page>
  );
}
