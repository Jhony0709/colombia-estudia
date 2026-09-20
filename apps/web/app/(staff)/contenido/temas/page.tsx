/**
 * Los temas del programa.
 * SSOT: reference/01-routing/routes.md:41, plan/07-contenido-y-migracion.md.
 *
 * Separada de las evaluaciones el 18/9. `/contenido` era una sola pantalla con cuatro
 * secciones —crear tema, lista de temas, crear evaluación, lista de evaluaciones—, es decir
 * dos objetos distintos apilados, cada uno con su formulario y su lista. Quien viene a
 * escribir un tema se comía media pantalla de evaluaciones para llegar a la suya.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { listLessons } from '@/features/content/server/lessons.service';
import { Button } from '@/components/atoms/button';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { LessonBrowser } from '../lesson-browser';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { BookOpen, CircleCheck, FilePen, Upload } from 'lucide-react';

export const metadata: Metadata = { title: 'Temas' };

export default async function LessonsPage() {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();

  const [lessons, curriculum, t] = await Promise.all([
    listLessons({ institutionId: ctx.institution.id }),
    listCurriculum(ctx.institution.id),
    getTranslations('content'),
  ]);
  const th = await getTranslations('help');

  const programs = curriculum.programs.map((program) => ({ id: program.id, name: program.name }));

  const published = lessons.filter((lesson) => lesson.hasPublished).length;
  const drafts = lessons.length - published;
  const withSubmission = lessons.filter((lesson) => lesson.requiresSubmission).length;

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('lessons') }]}
          />
        }
        overline={curriculum.programs.length === 1 ? curriculum.programs[0]!.name : t('overline')}
        title={t('lessonsTitle')}
        description={t('summary', { published })}
        action={
          <Button asChild variant="secondary">
            <Link href="/contenido/temas/nuevo">{t('newLesson')}</Link>
          </Button>
        }
      />

      <section aria-label={t('stats.label')}>
        <StatGrid>
          <StatCard label={t('stats.lessons')} value={lessons.length} icon={BookOpen} />
          <StatCard
            label={t('stats.published')}
            value={published}
            icon={CircleCheck}
            tone="success"
          />
          <StatCard
            label={t('stats.drafts')}
            value={drafts}
            icon={FilePen}
            tone={drafts > 0 ? 'warning' : 'info'}
          />
          <StatCard label={t('stats.withSubmission')} value={withSubmission} icon={Upload} />
        </StatGrid>
      </section>

      <PageSection title={t('listTitle', { count: lessons.length })} id="temas">
        <LessonBrowser lessons={lessons} programs={programs} />
      </PageSection>

      <PageHelp
        screen={t('lessonsTitle')}
        topics={[
          { title: th('lessons.whatTitle'), body: <p>{th('lessons.whatBody')}</p> },
          { title: th('lessons.statesTitle'), body: <p>{th('lessons.statesBody')}</p> },
          { title: th('lessons.findTitle'), body: <p>{th('lessons.findBody')}</p> },
        ]}
      />
    </Page>
  );
}
