/**
 * Los detalles de un curso que la persona todavía no tomó (7/10, Jhonny: «para los cursos
 * bloqueados puedo de igual manera ver los detalles, pero saldrán bloqueados»). La misma tarjeta
 * del catálogo al lado, con su acción, y el contenido completo —talleres, temas, actividades,
 * cuestionarios— con candado: se ve qué trae, no se abre nada.
 *
 * Si ya está en esa cohorte, va a su ruta (`/aprender/curso/…`). Lo que el catálogo no enseña
 * (cohorte cerrada, componente archivado, ids inventados) es 404.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CircleCheck, Lock } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCoursePreview, type PreviewItem } from '@/features/learn/server/catalog.service';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { whatsappUrl } from '@/features/marketing/contact-links';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { HelpCard } from '../../../dashboard-cards';
import { CourseCard, courseHref } from '../../../catalog-section';
import { FORM_ICONS } from '../../../route-rail';

export const metadata: Metadata = { title: 'Detalles del curso' };

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ cohortId: string; moduleId: string }>;
}) {
  const { cohortId, moduleId } = await params;
  const ctx = await getRequestContext();
  if (!ctx.person) notFound();

  const institutionId = ctx.institution.id;
  const personId = ctx.person.id;
  const [preview, pending, t, tc, format] = await Promise.all([
    getCoursePreview({ institutionId, personId, cohortId, moduleId }),
    listMyPendingRequests({ institutionId, personId }),
    getTranslations('learn'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  if (!preview) notFound();
  const { course, workshops, moduleItems, siblings } = preview;
  if (course.enrollment) redirect(courseHref(course));

  const contact = { phone: ctx.institution.supportPhone ?? null, name: ctx.person.givenName };
  const asked = pending.enroll[cohortId];
  const notice = asked
    ? t('catalog.groupRequested', {
        date: format.dateTime(new Date(asked.at), { day: 'numeric', month: 'long' }),
        module: siblings.find((s) => s.moduleId === asked.moduleId)?.name ?? course.name,
      })
    : course.beforeEntry
      ? t('preview.beforeEntry')
      : course.free
        ? t('preview.lockedFree')
        : t('preview.lockedPaid');
  // El mismo atajo que el grupo del catálogo: ya lo pidió, que pueda escribir con el mensaje hecho.
  const wa = asked
    ? whatsappUrl(
        contact.phone,
        t('catalog.requestMessage', { name: contact.name, course: course.programName })
      )
    : null;
  const groups = [
    ...workshops,
    ...(moduleItems.length > 0 ? [{ name: t('preview.moduleItems'), items: moduleItems }] : []),
  ];

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/aprender' },
              { label: t('catalog.others'), href: '/aprender#cursos-abiertos' },
              { label: course.name },
            ]}
          />
        }
        overline={
          course.programModules > 1
            ? t('catalog.componentOfProgram', {
                position: course.position,
                total: course.programModules,
                program: course.programName,
              })
            : course.programName
        }
        title={course.name}
        description={course.description ?? undefined}
      />
      <div className="motion-enter grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <PageSection title={t('preview.title')}>
            <div className="space-y-4">
              <p className="bg-surface-sunken rounded-control type-caption text-text m-0 flex items-start gap-2 p-3">
                {asked ? (
                  <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
                ) : (
                  <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
                )}
                {notice}
              </p>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-label text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                >
                  {t('catalog.writeUs')}
                  <span className="sr-only"> {t('catalog.newTab')}</span>
                </a>
              )}
              {groups.length === 0 ? (
                <p className="type-body text-text-muted m-0">{t('emptyHint')}</p>
              ) : (
                groups.map((group) => (
                  <LockedGroup key={group.name} name={group.name} items={group.items} />
                ))
              )}
            </div>
          </PageSection>
        </div>
        <aside className="min-w-0 space-y-6" aria-label={t('aside.label')}>
          <CourseCard course={course} contact={contact} requested={pending.enroll} detail />
          {siblings.length > 0 && (
            <nav
              aria-label={t('preview.siblings', { program: course.programName })}
              className="bg-surface-base rounded-card elevation-resting space-y-2 p-5"
            >
              <h2 className="type-body-emphasis text-text m-0">
                {t('preview.siblings', { program: course.programName })}
              </h2>
              <ul className="m-0 list-none space-y-1 p-0">
                {siblings.map((s) => (
                  <li key={s.moduleId}>
                    <Link
                      href={`/aprender/catalogo/${cohortId}/${s.moduleId}`}
                      className="type-body text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                    >
                      {t('catalog.componentOf', {
                        position: s.position,
                        total: course.programModules,
                      })}
                      : {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
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

/** Un taller con sus pasos, todos con candado: título y forma, sin enlace. */
async function LockedGroup({ name, items }: { name: string; items: PreviewItem[] }) {
  const t = await getTranslations('learn');
  return (
    <section className="bg-surface-base border-border-muted rounded-card border p-4 sm:p-5">
      <h3 className="type-overline text-text-muted m-0 mb-3 uppercase">{name}</h3>
      <ol className="m-0 list-none space-y-1 p-0">
        {items.map((item) => {
          const Icon = FORM_ICONS[item.form];
          return (
            <li key={item.id} className="flex items-center gap-3 py-1.5">
              <Icon aria-hidden className="text-text-subtle size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="type-body text-text-muted block">{item.title}</span>
                <span className="type-caption text-text-muted block">{t(`form.${item.form}`)}</span>
              </span>
              <Lock aria-hidden className="text-text-subtle size-4 shrink-0" />
              <span className="sr-only">{t('preview.locked')}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
