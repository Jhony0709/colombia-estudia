/**
 * Las asignaturas de la institución.
 * SSOT: reference/01-routing/routes.md, plan/06-cohortes-y-personas.md:19-22.
 *
 * Sale de `/admin/institucion` el 18/9, con los programas. La capacidad no cambia.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { Page, PageHeader } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { SubjectsManager } from './subjects-manager';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Asignaturas' };

export default async function SubjectsPage() {
  await requireCapability('institution.manage');
  const ctx = await getRequestContext();

  const [curriculum, t] = await Promise.all([
    listCurriculum(ctx.institution.id),
    getTranslations('admin.curriculum'),
  ]);
  const th = await getTranslations('help');

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('subjects') }]}
          />
        }
        title={t('subjects')}
        description={t('subjectsHint', { count: curriculum.subjects.length })}
      />

      <SubjectsManager subjects={curriculum.subjects} />

      <PageHelp
        screen={t('subjects')}
        topics={[{ title: th('subjects.whatTitle'), body: <p>{th('subjects.whatBody')}</p> }]}
      />
    </Page>
  );
}
