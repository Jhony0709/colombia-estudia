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
import { ProgramBuilderView } from './program-builder';

export const metadata: Metadata = { title: 'Constructor del programa' };

export default async function ProgramBuilderPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();
  const { programId } = await params;

  const [builder, t, tc] = await Promise.all([
    getProgramBuilder({ institutionId: ctx.institution.id, programId }),
    getTranslations('builder'),
    getTranslations('crumbs'),
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
      />

      <ProgramBuilderView builder={builder} />
    </Page>
  );
}
