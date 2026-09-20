/**
 * Carga CSV de matrículas, en tres pasos.
 * SSOT: plan/06-cohortes-y-personas.md:38-56 — `/cohortes/[id]/importar`.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getCohortDetail } from '@/features/cohorts/server/enrollments.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Alert } from '@/components/atoms/alert';
import { ImportWizard } from './import-wizard';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Importar matrículas' };

type Params = Promise<{ cohortId: string }>;

export default async function ImportPage({ params }: { params: Params }) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  const { cohortId } = await params;

  const [cohort, t] = await Promise.all([
    getCohortDetail({ institutionId: ctx.institution.id, cohortId }),
    getTranslations('import'),
  ]);

  if (!cohort) notFound();

  const openForEnrolment = cohort.status === 'PLANNED' || cohort.status === 'OPEN';

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        overline={cohort.programName}
        title={t('title')}
        description={t('subtitle', { cohort: `${cohort.code} — ${cohort.name}` })}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('cohorts'), href: '/cohortes' },
              { label: cohort.code, href: `/cohortes/${cohort.id}` },
              { label: tc('import') },
            ]}
          />
        }
      />

      {openForEnrolment ? (
        <ImportWizard cohortId={cohort.id} />
      ) : (
        <Alert severity="warning">{t('closedForEnrolment')}</Alert>
      )}
    </Page>
  );
}
