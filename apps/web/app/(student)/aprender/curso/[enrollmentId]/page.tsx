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
import { ArrowRight } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { Button } from '@/components/atoms/button';
import { HelpCard } from '../../dashboard-cards';
import { RouteSection } from '../../route-section';
import { hrefFor } from '../../route-rail';

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
        <div className="min-w-0">
          <RouteSection
            outline={outline}
            supportEmail={ctx.institution.supportEmail}
            requested={pending.unlock}
            title={t('course.routeTitle')}
          />
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
