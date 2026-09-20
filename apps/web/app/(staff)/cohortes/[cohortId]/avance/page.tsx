/**
 * El avance de una cohorte, para el equipo.
 * SSOT: routes.md (§Cohortes), reportes.md, plan/08 §7.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import { getCohortProgress } from '@/features/cohorts/server/progress.service';
import { CohortProgressView } from '@/features/cohorts/components/cohort-progress-view';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Avance' };

export default async function CohortProgressPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const ctx = await getRequestContext();
  if ((ctx.capabilities.get('progress.read.cohort')?.length ?? 0) === 0) redirect(HOME_AFTER_LOGIN);
  const { cohortId } = await params;

  const [progress, t, tb] = await Promise.all([
    getCohortProgress({ institutionId: ctx.institution.id, cohortId }),
    getTranslations('cohortProgress'),
    getTranslations('crumbs'),
  ]);
  if (!progress) notFound();

  return (
    <Page wide>
      <PageHeader
        overline={`${progress.cohort.code} · ${progress.cohort.programName}`}
        title={t('title')}
        description={t('description')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: tb('cohorts'), href: '/cohortes' },
              { label: progress.cohort.code, href: `/cohortes/${progress.cohort.id}` },
              { label: t('crumb') },
            ]}
          />
        }
      />
      <CohortProgressView
        progress={progress}
        personLinks
        exportHref={`/api/cohorts/${progress.cohort.id}/export`}
      />
    </Page>
  );
}
