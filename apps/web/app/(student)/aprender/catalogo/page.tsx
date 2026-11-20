/**
 * `/aprender/catalogo` (20/11): los cursos abiertos, fuera del inicio. El inicio dice qué
 * toca hoy; elegir otro curso es otra pregunta y tiene su pantalla.
 * SSOT: reference/01-routing/routes.md
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listOpenCourses } from '@/features/learn/server/catalog.service';
import { listMyEnrollments } from '@/features/learn/server/cohort.service';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { CatalogSection } from '../catalog-section';

export const metadata: Metadata = { title: 'Cursos' };

export default async function CatalogPage() {
  const ctx = await getRequestContext();
  if (!ctx.person) redirect('/aprender');
  const institutionId = ctx.institution.id;
  const personId = ctx.person.id;

  const [mine, courses, pending, t, tc] = await Promise.all([
    listMyEnrollments({ institutionId, personId }),
    listOpenCourses({ institutionId, personId }),
    listMyPendingRequests({ institutionId, personId }),
    getTranslations('learn'),
    getTranslations('crumbs'),
  ]);
  // Solo vistas de estudiante (31/10): sin catálogo, que inscribiría de verdad al admin.
  const catalog = mine.length > 0 && mine.every((row) => row.preview) ? [] : courses;

  return (
    <Page wide>
      <PageHeader
        title={t('catalog.others')}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/aprender' }, { label: t('catalog.others') }]}
          />
        }
      />
      <CatalogSection
        courses={catalog}
        contact={{ phone: ctx.institution.supportPhone ?? null, name: ctx.person.givenName }}
        requested={pending.enroll}
        title={t('explore.listTitle')}
      />
    </Page>
  );
}
