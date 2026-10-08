/**
 * La página de un curso del estudiante (7/10, Jhonny: la ruta «no debería verse en /aprender,
 * sino en la página de los detalles del curso»). Un curso aquí es la matrícula: el programa en
 * su cohorte, con todos sus componentes. Cabecera con el avance y «Continuar»; debajo, la ruta.
 *
 * Llegan aquí «Ir a mi ruta» (catálogo), el enlace del héroe de `/aprender`, «Ver toda la ruta»
 * del riel y la vuelta del tema y del examen. Una matrícula ajena o inventada es 404.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Award, ChartColumn } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import { listOpenCourses } from '@/features/learn/server/catalog.service';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { ResultMoment } from '@/components/atoms/motion';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { Button } from '@/components/atoms/button';
import { cn } from '@/lib/utils';
import { HelpCard } from '../../dashboard-cards';
import { RouteSection } from '../../route-section';
import { CourseCard } from '../../catalog-section';
import { hrefFor } from '../../route-rail';
import { COURSE_CARD_GRID } from '../../course-card-layout';

export const metadata: Metadata = { title: 'Tu curso' };

export default async function CoursePage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const ctx = await getRequestContext();
  if (!ctx.person) notFound();

  const institutionId = ctx.institution.id;
  const personId = ctx.person.id;
  const [outline, pending, t, tc] = await Promise.all([
    getCohortOutline({ institutionId, personId, enrollmentId }),
    listMyPendingRequests({ institutionId, personId }),
    getTranslations('learn'),
    getTranslations('crumbs'),
  ]);
  // La consulta filtra por `studentId`: si no es suya, no vuelve.
  if (outline.enrollmentId !== enrollmentId || !outline.cohort) notFound();

  const { cohort, gate, progress, resume } = outline;
  const percent =
    progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);
  const starting = progress.completed === 0;

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/aprender' }, { label: cohort.programName }]}
          />
        }
        overline={cohort.name}
        title={cohort.programName}
        description={
          gate
            ? undefined
            : t('course.progress', {
                completed: progress.completed,
                total: progress.total,
                percent,
              })
        }
        action={
          !gate && resume ? (
            <Button asChild>
              <Link href={hrefFor(resume)}>
                {starting ? t('startLabel') : t('continueLabel')}
                <span className="sr-only"> {resume.title}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="motion-enter grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-8">
          {gate?.kind === 'COMPLETED' ? (
            <CompletedCourse
              program={cohort.programName}
              institutionId={institutionId}
              personId={personId}
              contact={{ phone: ctx.institution.supportPhone ?? null, name: ctx.person.givenName }}
              requested={pending.enroll}
            />
          ) : (
            <RouteSection
              outline={outline}
              supportEmail={ctx.institution.supportEmail}
              requested={pending.unlock}
              title={t('course.routeTitle')}
            />
          )}
        </div>
        <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
          <HelpCard
            phone={ctx.institution.supportPhone ?? null}
            email={ctx.institution.supportEmail ?? null}
            name={ctx.person.givenName}
          />
        </aside>
      </div>
    </Page>
  );
}

/**
 * Curso terminado (8/10, Jhonny: «proponer volver a la lista de cursos»): el momento de éxito,
 * qué hacer ahora —otro curso primero; resultados y constancias al lado— y hasta tres cursos
 * que todavía no tomó, con la misma tarjeta del catálogo.
 */
async function CompletedCourse({
  program,
  institutionId,
  personId,
  contact,
  requested,
}: {
  program: string;
  institutionId: string;
  personId: string;
  contact: { phone: string | null; name: string };
  requested: Awaited<ReturnType<typeof listMyPendingRequests>>['enroll'];
}) {
  const [t, courses] = await Promise.all([
    getTranslations('learn.course.done'),
    listOpenCourses({ institutionId, personId }),
  ]);
  const next = courses.filter((c) => !c.enrollment && !c.beforeEntry).slice(0, 3);
  return (
    <>
      <section
        aria-labelledby="curso-terminado"
        className="bg-surface-base border-border-muted rounded-card elevation-resting motion-enter-md flex flex-col items-start gap-6 border p-6 sm:flex-row sm:items-center sm:p-8"
      >
        <ResultMoment kind="success" />
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <h2 id="curso-terminado" className="type-heading text-text m-0 text-balance">
              {t('title', { program })}
            </h2>
            <p className="type-body text-text-muted max-w-reading m-0">
              {next.length > 0 ? t('body') : t('bodyNoCourses')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild>
              <Link href={next.length > 0 ? '/aprender#cursos-abiertos' : '/aprender'}>
                {next.length > 0 ? t('catalog') : t('home')}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </Button>
            <Link
              href="/aprender/resultados"
              className="type-label text-text-link min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
            >
              <ChartColumn aria-hidden className="size-4 shrink-0" />
              {t('results')}
            </Link>
            <Link
              href="/aprender/certificados"
              className="type-label text-text-link min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
            >
              <Award aria-hidden className="size-4 shrink-0" />
              {t('certificates')}
            </Link>
          </div>
        </div>
      </section>
      {next.length > 0 && (
        <PageSection title={t('suggestions')}>
          <ul
            className={cn(
              'motion-stagger m-0 grid list-none items-start gap-4 p-0',
              COURSE_CARD_GRID
            )}
          >
            {next.map((course) => (
              <li key={`${course.cohortId}-${course.moduleId}`} className="min-w-0">
                <CourseCard
                  course={course}
                  contact={contact}
                  requested={requested}
                  headingLevel={3}
                />
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </>
  );
}
