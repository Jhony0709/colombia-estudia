/**
 * Los programas y sus módulos.
 * SSOT: reference/01-routing/routes.md, plan/06-cohortes-y-personas.md:19-22.
 *
 * Sale de `/admin/institucion` el 18/9: la forma del programa es contenido, no un ajuste de
 * la institución, y quien escribe temas necesita llegar a ella sin pasar por administración.
 * La capacidad no cambia — sigue siendo `institution.manage`.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { Button } from '@/components/atoms/button';
import { Page, PageHeader } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { ProgramsManager } from './programs-manager';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Programas' };

export default async function ProgramsPage() {
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
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('programs') }]}
          />
        }
        title={t('programs')}
        description={t('programsHint', { count: curriculum.programs.length })}
        action={
          <Button asChild variant="secondary">
            <Link href="/contenido/programas/nuevo">{t('newProgram')}</Link>
          </Button>
        }
      />

      <ProgramsManager programs={curriculum.programs} />

      <PageHelp
        screen={t('programs')}
        topics={[
          { title: th('programs.whatTitle'), body: <p>{th('programs.whatBody')}</p> },
          { title: th('programs.archiveTitle'), body: <p>{th('programs.archiveBody')}</p> },
        ]}
      />
    </Page>
  );
}
