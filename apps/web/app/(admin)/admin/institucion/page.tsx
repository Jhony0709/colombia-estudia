/**
 * Institution admin page: los ajustes de la institución.
 *
 * El currículo —programas, módulos y asignaturas— salió de aquí el 18/9 a
 * `/contenido/programas` y `/contenido/asignaturas`, con la misma capacidad: es la forma
 * del contenido, no un ajuste de la institución, y aquí no lo encontraba nadie.
 * SSOT: routes.md:56 (/admin/institucion, ADMIN), plan/06-cohortes-y-personas.md:11-22
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getInstitutionOverview } from '@/features/admin/server/institution.service';
import { getRegistrationSettings } from '@/features/admin/server/registration.service';
import { Page, PageHeader } from '@/components/templates/page';
import { InstitutionForm } from './institution-form';
import { RegistrationForm } from './registration-form';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getRequestContext();
  return { title: `Institución · ${ctx.institution.name}` };
}

export default async function InstitutionPage() {
  await requireCapability('institution.manage');
  const ctx = await getRequestContext();

  const [overview, registration, t] = await Promise.all([
    getInstitutionOverview(ctx.institution.id),
    getRegistrationSettings(ctx.institution.id),
    getTranslations('admin.institution'),
  ]);

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('institution') }]}
          />
        }
        overline={t('overline')}
        title={overview.settings.name}
        description={
          overview.primaryDomain ? `${t('domain')}: ${overview.primaryDomain}` : t('noDomain')
        }
      />

      <InstitutionForm settings={overview.settings} />

      {/* El registro público (Fase B): su propia sección y su propio botón. */}
      <RegistrationForm settings={registration} />
    </Page>
  );
}
