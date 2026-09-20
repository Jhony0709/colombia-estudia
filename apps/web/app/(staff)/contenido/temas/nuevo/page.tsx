/**
 * Alta de un tema.
 * SSOT: reference/01-routing/routes.md, plan/07-contenido-y-migracion.md.
 *
 * Separada de la lista el 18/9. El formulario vivía dentro de `/contenido/temas`, encima de
 * los 110 temas: no tenía título propio, no se podía enlazar, el foco no llegaba a él al
 * entrar y el botón atrás del navegador no deshacía el haber empezado a crear. Una ruta
 * propia resuelve las cuatro cosas sin código: `FocusManager` lleva el foco al `h1` en cada
 * cambio de ruta (`lib/a11y/focus-manager.tsx`).
 *
 * El formulario redirige al editor al crear, así que quien viene a escribir un tema no
 * vuelve a pasar por ninguna lista.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { Page, PageHeader } from '@/components/templates/page';
import { CreateLessonForm } from '../../create-forms';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Nuevo tema' };

export default async function NewLessonPage() {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();

  const [curriculum, t] = await Promise.all([
    listCurriculum(ctx.institution.id),
    getTranslations('content'),
  ]);

  // El módulo se elige con el nombre del programa delante: con varios programas, "Módulo 1"
  // a secas no identifica nada.
  const modules = curriculum.programs.flatMap((program) =>
    program.modules.map((module) => ({
      id: module.id,
      name: module.name,
      programId: program.id,
      programName: program.name,
    }))
  );
  const subjects = curriculum.subjects.map((subject) => ({ id: subject.id, name: subject.name }));

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('lessons'), href: '/contenido/temas' },
              { label: tc('new') },
            ]}
          />
        }
        title={t('createLessonTitle')}
        description={t('createLessonHint')}
      />

      <CreateLessonForm modules={modules} subjects={subjects} />
    </Page>
  );
}
