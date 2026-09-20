/**
 * `/admin/politicas`: qué hace la institución con la mora. Dos banderas y una advertencia.
 * SSOT: routes.md:71, plan/09 §7, acceso-y-cartera.md §2.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getPolicy } from '@/features/admin/server/policies.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { Alert } from '@/components/atoms/alert';
import { PolicyForm } from './policy-form';

export const metadata: Metadata = { title: 'Políticas' };

export default async function PoliciesPage() {
  await requireCapability('institution.manage');
  const ctx = await getRequestContext();
  const [policy, t, tb] = await Promise.all([
    getPolicy({ institutionId: ctx.institution.id }),
    getTranslations('policies'),
    getTranslations('crumbs'),
  ]);
  return (
    <Page>
      <PageHeader
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[{ label: tb('home'), href: '/ingresar' }, { label: t('crumb') }]}
          />
        }
      />
      <Alert severity="info">{t('principle')}</Alert>
      <PageSection title={t('flagsTitle')} card>
        <PolicyForm
          initial={{
            requireAgreementForNextCohort: policy.requireAgreementForNextCohort,
            notifyPayerOnOverdue: policy.notifyPayerOnOverdue,
          }}
        />
      </PageSection>
    </Page>
  );
}
