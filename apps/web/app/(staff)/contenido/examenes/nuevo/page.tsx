/**
 * Alta de una evaluación.
 * SSOT: reference/01-routing/routes.md, plan/07-contenido-y-migracion.md.
 *
 * Separada de la lista el 18/9, por lo mismo que el alta de un tema: un formulario encima
 * de la lista no tiene título propio, no se puede enlazar y el foco no llega a él al entrar.
 * Ver la cabecera de `../../temas/nuevo/page.tsx`.
 *
 * Una diagnóstica se crea sin módulo —es del programa entero—, así que el formulario
 * necesita los programas además de los módulos. Y los temas (20/9), para decir de cuál es
 * examen: así aparece justo después de ese tema en la ruta del estudiante.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { listLessons } from '@/features/content/server/lessons.service';
import { Page, PageHeader } from '@/components/templates/page';
import { CreateAssessmentForm } from '../../create-forms';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Nuevo examen' };

export default async function NewAssessmentPage() {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();

  const [curriculum, allLessons, t] = await Promise.all([
    listCurriculum(ctx.institution.id),
    listLessons({ institutionId: ctx.institution.id }),
    getTranslations('content'),
  ]);

  const modules = curriculum.programs.flatMap((program) =>
    program.modules.map((module) => ({
      id: module.id,
      name: module.name,
      programId: program.id,
      programName: program.name,
    }))
  );
  const programs = curriculum.programs.map((program) => ({ id: program.id, name: program.name }));
  // Para elegir de qué tema es examen (20/9): el formulario filtra por el módulo elegido.
  const lessons = allLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    moduleId: lesson.moduleId,
    position: lesson.position,
  }));

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('assessments'), href: '/contenido/examenes' },
              { label: tc('new') },
            ]}
          />
        }
        title={t('createAssessmentTitle')}
        description={t('createAssessmentHint')}
      />

      <CreateAssessmentForm programs={programs} modules={modules} lessons={lessons} />
    </Page>
  );
}
