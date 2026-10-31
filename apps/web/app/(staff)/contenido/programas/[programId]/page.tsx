/**
 * El constructor del programa (23/9): la ruta del estudiante, vista por quien la escribe.
 * SSOT: reference/01-routing/routes.md, decisión del 23/9.
 *
 * Aquí se ve el programa entero como lo verá el estudiante —módulo, tema, sus exámenes,
 * siguiente tema— con el estado de publicación de cada pieza, y desde aquí se crea lo que
 * falta sin volver a decir programa, módulo ni tema: el sistema ya lo sabe. Los editores de
 * cada pieza siguen siendo los suyos; esto es el mapa y la puerta.
 *
 * `lesson.author`, como los temas y los exámenes: quien escribe contenido necesita el mapa.
 * Crear y mover módulos sigue en `/contenido/programas` con `institution.manage`.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getProgramBuilder } from '@/features/content/server/builder.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { listPreviewCohorts } from '@/features/cohorts/server/preview.service';
import { ProgramBuilderView } from './program-builder';
import { StudentPreviewPicker } from './student-preview-picker';

export const metadata: Metadata = { title: 'Constructor del programa' };

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();
  const { programId } = await params;

  // Vista de estudiante (31/10): solo administración, y solo cohortes con contenido.
  const canPreview = (ctx.capabilities.get('institution.manage')?.length ?? 0) > 0;
  const [builder, t, tc, previewCohorts] = await Promise.all([
    getProgramBuilder({ institutionId: ctx.institution.id, programId }),
    getTranslations('builder'),
    getTranslations('crumbs'),
    canPreview ? listPreviewCohorts({ institutionId: ctx.institution.id, programId }) : [],
  ]);
  if (!builder) notFound();

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('programs'), href: '/contenido/programas' },
              { label: builder.program.name },
            ]}
          />
        }
        overline={builder.program.code}
        title={builder.program.name}
        description={t('readiness', {
          published: builder.readiness.published,
          total: builder.readiness.total,
        })}
        action={
          previewCohorts.length > 0 ? <StudentPreviewPicker cohorts={previewCohorts} /> : undefined
        }
      />

      <ProgramBuilderView builder={builder} />
    </Page>
  );
}
