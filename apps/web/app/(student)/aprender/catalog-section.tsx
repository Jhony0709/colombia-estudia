/**
 * Los cursos que la persona puede tomar en `/aprender` (25/9; rehecho el 6/10 y el 7/10). Un
 * curso es un componente (cliente, 25/9) y la lista es de componentes (Jhonny, 7/10: «la lista
 * de componentes, con su diseño y de qué programa hacen parte»), agrupados por su programa.
 * Gratuitos y de pago: el gratuito se toma ya («Inscribirme y empezar»); del de pago se pide la
 * inscripción entrando por ese componente y la matrícula la hace operación.
 *
 * Cada tarjeta responde lo que un adulto pregunta antes de inscribirse: de qué programa es y
 * en qué lugar («Componente 1 de 2»), de qué va (sus talleres), cuánto es (temas, actividades,
 * cuestionarios) y cuánto cuesta. El grupo dice lo común: cuántos componentes, el precio por
 * componente y hasta cuándo está abierta la cohorte. Nada de códigos internos.
 *
 * - `CatalogSection`: la lista, un grupo por programa; todas las tarjetas son la misma, del
 *   mismo ancho, tenga el grupo uno o varios componentes (Jhonny, 7/10).
 * - `FeaturedCourse`: el curso destacado de quien todavía no tiene ninguno; es el héroe.
 *
 * Server Components: solo los botones llevan JavaScript. Sin cursos no se pinta nada.
 */

import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { BookOpen, CircleCheck, ClipboardCheck, FileUp, Layers } from 'lucide-react';
import { PageSection } from '@/components/templates/page';
import { Badge } from '@/components/atoms/badge';
import { Tooltip } from '@/components/atoms/tooltip';
import { Button } from '@/components/atoms/button';
import type { CatalogCourse } from '@/features/learn/server/catalog.service';
import type { PendingEnroll } from '@/features/requests/server/requests.service';
import { whatsappUrl } from '@/features/marketing/contact-links';
import { cn } from '@/lib/utils';
import { EnrollButton } from './enroll-button';
import { RequestButton } from './request-button';
import { WorkshopsDisclosure } from './workshops-disclosure';

/** Los detalles de un curso: su ruta si está en él; si no, la página del curso bloqueado. */
export const courseHref = (course: CatalogCourse): Route =>
  (course.enrollment
    ? `/aprender/curso/${course.enrollment.id}`
    : `/aprender/catalogo/${course.cohortId}/${course.moduleId}`) as Route;

export interface CatalogContact {
  phone: string | null;
  name: string;
}

type Translate = Awaited<ReturnType<typeof getTranslations<'learn.catalog'>>>;
type Format = Awaited<ReturnType<typeof getFormatter>>;

/** Los talleres que se ven como etiquetas; el resto, «+N». */
const MAX_WORKSHOPS = 4;

function priceLabel(course: CatalogCourse, t: Translate, format: Format): string {
  if (course.free) return t('free');
  if (!course.price) return t('paid');
  const amount = format.number(course.price.amount, {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
  return t('price', { amount, period: t(`period.${course.price.period}`) });
}

const untilOf = (course: CatalogCourse, format: Format) =>
  format.dateTime(new Date(`${course.endsOn}T00:00:00.000Z`), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

function Cover({ course, className }: { course: CatalogCourse; className?: string }) {
  // Decorativa: el nombre del curso va al lado (WCAG 1.1.1). URL firmada de Storage.
  return course.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={course.coverUrl}
      alt=""
      className={cn('bg-surface-sunken aspect-[2/1] w-full object-cover', className)}
    />
  ) : (
    // Sin portada, el azul de marca con el icono del programa: una tarjeta gris parecía rota.
    <div
      aria-hidden="true"
      className={cn(
        'bg-accent-base text-text-on-accent flex aspect-[2/1] w-full items-center justify-center',
        className
      )}
    >
      <Layers className="size-10 opacity-80" />
    </div>
  );
}

/**
 * La onda pequeña del landing (`AlbaWave` «side», 7/10) como borde inferior de la portada, con
 * tokens de la app en vez de los colores del sitio: sol, azul y el fondo de la tarjeta.
 */
function CoverWave() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 600 160"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 -bottom-px block h-[28%] w-full"
    >
      <path
        className="fill-brand-yellow"
        d="M0 70C120 40 260 50 380 96C460 126 540 136 600 128V160H0Z"
      />
      <path
        className="fill-accent-base"
        d="M0 104C140 76 280 86 400 122C480 146 550 152 600 148V160H0Z"
      />
      <path
        className="fill-surface-base"
        d="M0 140C150 120 300 126 430 148C500 158 560 160 600 158V160H0Z"
      />
    </svg>
  );
}

/** «Componente 1 de 2» sobre la portada: dónde está en su programa. */
function PositionBadge({ course, t }: { course: CatalogCourse; t: Translate }) {
  if (course.programModules < 2) return null;
  return (
    <span className="absolute left-3 top-3">
      <Badge variant="neutral">
        {t('componentOf', { position: course.position, total: course.programModules })}
      </Badge>
    </span>
  );
}

/** Los talleres del componente: de qué va, en el orden de la ruta. */
function Workshops({ course, t }: { course: CatalogCourse; t: Translate }) {
  if (course.workshops.length === 0) return null;
  const shown = course.workshops.slice(0, MAX_WORKSHOPS);
  const rest = course.workshops.length - shown.length;
  return (
    <ul aria-label={t('workshops')} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {shown.map(({ name }) => (
        <li key={name}>
          <Badge variant="info">{name}</Badge>
        </li>
      ))}
      {rest > 0 && (
        <li>
          <Badge variant="neutral">{t('moreWorkshops', { count: rest })}</Badge>
        </li>
      )}
    </ul>
  );
}

/**
 * Cuánto es: temas, actividades y cuestionarios. `compact` (tarjeta, 7/10): icono y número; la
 * palabra va en `sr-only` y en tooltip al pasar el ratón (en «Ver talleres» se lee completa).
 */
function Load({
  course,
  t,
  compact = false,
}: {
  course: CatalogCourse;
  t: Translate;
  compact?: boolean;
}) {
  const items = [
    {
      Icon: BookOpen,
      count: course.lessonCount,
      text: t('lessonCount', { count: course.lessonCount }),
    },
    {
      Icon: FileUp,
      count: course.activityCount,
      text: t('activityCount', { count: course.activityCount }),
    },
    {
      Icon: ClipboardCheck,
      count: course.assessmentCount,
      text: t('assessmentCount', { count: course.assessmentCount }),
    },
  ].filter((item, i) => i === 0 || item.count > 0);
  return (
    <ul className="type-caption text-text-muted m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
      {items.map(({ Icon, count, text }) => (
        <li key={text}>
          {compact ? (
            <Tooltip label={text}>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Icon aria-hidden className="size-4 shrink-0" />
                <span aria-hidden>{count}</span>
                <span className="sr-only">{text}</span>
              </span>
            </Tooltip>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Icon aria-hidden className="size-4 shrink-0" />
              {text}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Action({
  course,
  contact,
  requested,
  t,
}: {
  course: CatalogCourse;
  contact: CatalogContact;
  requested: Record<string, PendingEnroll>;
  t: Translate;
}) {
  if (course.free) {
    return (
      <EnrollButton
        cohortId={course.cohortId}
        moduleId={course.moduleId}
        courseName={course.name}
      />
    );
  }
  return (
    <RequestButton
      cohortId={course.cohortId}
      moduleId={course.moduleId}
      courseName={course.name}
      requestedAt={requested[course.cohortId]?.at ?? null}
      whatsappHref={whatsappUrl(
        contact.phone,
        t('requestMessage', {
          name: contact.name,
          course: `${course.programName} · ${course.name}`,
        })
      )}
    />
  );
}

/**
 * «Ver talleres» (7/10, Jhonny): desplegable con cada taller y lo que trae. `<details>`: abre y
 * cierra con teclado y sin JavaScript; plegado no empuja el pie de la tarjeta.
 */
function WorkshopList({ course, t }: { course: CatalogCourse; t: Translate }) {
  if (course.workshops.length === 0) return null;
  return (
    <WorkshopsDisclosure label={t('showWorkshops', { count: course.workshops.length })}>
      <ol className="border-border-muted m-0 mt-1 list-none space-y-2 border-l-2 p-0 pl-3">
        {course.workshops.map((w) => (
          <li key={w.name}>
            <span className="type-body-emphasis text-text block">{w.name}</span>
            <span className="type-caption text-text-muted block">
              {[
                t('lessonCount', { count: w.lessonCount }),
                w.activityCount > 0 ? t('activityCount', { count: w.activityCount }) : null,
                w.hasQuiz ? t('withQuiz') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </WorkshopsDisclosure>
  );
}

/** El precio del pie, junto a la carga (7/10). */
function PriceTag({ course, t, format }: { course: CatalogCourse; t: Translate; format: Format }) {
  if (course.free) {
    return <p className="type-subheading text-status-success-base m-0">{t('free')}</p>;
  }
  if (!course.price) {
    return <p className="type-caption text-text-muted m-0">{t('priceOnRequest')}</p>;
  }
  return (
    <p className="type-subheading text-accent-base m-0 tabular-nums">
      <span>
        {format.number(course.price.amount, {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        })}
      </span>
      {/* El periodo no se ve (Jhonny, 7/10: «sobra»); el lector lo dice. */}
      <span className="sr-only"> {t(`period.${course.price.period}`)}</span>
    </p>
  );
}

/**
 * Una tarjeta de componente (7/10, inspirada en las tarjetas de cursos que mostró Jhonny;
 * compactada el mismo día): portada con pastillas flotantes y la onda del landing; programa y nombre; «Ver
 * talleres»; al pie la carga con iconos y el precio; y la acción. La fecha no va: la dice el
 * grupo.
 */
export async function CourseCard({
  course,
  contact,
  requested,
  detail = false,
}: {
  course: CatalogCourse;
  contact: CatalogContact;
  requested: Record<string, PendingEnroll>;
  /** En la página del curso: sin enlace en el título ni «Ver talleres» (el contenido va al lado). */
  detail?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('learn.catalog'), getFormatter()]);
  const id = `curso-${course.cohortId}-${course.moduleId}`;
  const asked = Boolean(requested[course.cohortId]);
  const Heading = detail ? 'h2' : 'h4';
  // Lo suyo se marca y no se ofrece (7/10): «En curso» lleva a su ruta; «Terminado», a nada.
  const status = course.enrollment
    ? course.enrollment.status === 'ACTIVE'
      ? ({ variant: 'info', label: t('enrolledPill') } as const)
      : ({ variant: 'success', label: t('completedPill') } as const)
    : asked
      ? ({ variant: 'success', label: t('requestedPill') } as const)
      : null;
  return (
    <article
      aria-labelledby={id}
      className="bg-surface-base border-border-muted rounded-card elevation-resting flex h-full flex-col overflow-hidden border"
    >
      <div className="relative">
        <Cover course={course} className="aspect-[9/4]" />
        <CoverWave />
        <PositionBadge course={course} t={t} />
        {/* El estado como pastilla flotante: en curso, terminado o ya pedido (el grupo lo explica). */}
        {status && (
          <span className="absolute right-3 top-3">
            <Badge variant={status.variant}>{status.label}</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="min-w-0 truncate">
          <Badge variant="info">{course.programName}</Badge>
        </span>
        <Heading id={id} className="type-body-emphasis text-text m-0 line-clamp-2 text-balance">
          {detail ? (
            course.name
          ) : (
            // Los detalles (7/10): el suyo lleva a su ruta; el que no tomó, a verlo bloqueado.
            <Link
              href={courseHref(course)}
              className="hover:text-text-link underline-offset-4 hover:underline"
            >
              {course.name}
            </Link>
          )}
        </Heading>
        {!detail && <WorkshopList course={course} t={t} />}
        <div className="border-border-muted mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3">
          <Load course={course} t={t} compact />
          <PriceTag course={course} t={t} format={format} />
        </div>
        {course.enrollment?.status === 'ACTIVE' ? (
          <div className="pt-1">
            <Button asChild className="w-full">
              <Link href={courseHref(course)}>
                {t('goToRoute')}
                <span className="sr-only"> {course.name}</span>
              </Link>
            </Button>
          </div>
        ) : (
          !course.enrollment &&
          !course.beforeEntry &&
          !asked && (
            <div className="pt-1">
              <Action course={course} contact={contact} requested={requested} t={t} />
            </div>
          )
        )}
      </div>
    </article>
  );
}

export async function FeaturedCourse({
  course,
  contact,
  requested = {},
}: {
  course: CatalogCourse;
  contact: CatalogContact;
  /** Cursos de pago ya pedidos: `cohortId` → ISO (6/10). */
  requested?: Record<string, PendingEnroll>;
}) {
  const [t, format] = await Promise.all([getTranslations('learn.catalog'), getFormatter()]);
  return (
    <section
      aria-labelledby="curso-destacado"
      className="bg-surface-base border-border-muted rounded-card elevation-resting motion-enter-md grid overflow-hidden border md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-4 p-6 sm:p-8 md:order-first">
        <p className="type-overline text-text-muted m-0 uppercase">
          {course.free ? t('featuredFree') : t('featuredPaid')} ·{' '}
          {course.programModules > 1
            ? t('componentOfProgram', {
                position: course.position,
                total: course.programModules,
                program: course.programName,
              })
            : course.programName}
        </p>
        <h2 id="curso-destacado" className="type-display text-text m-0 text-balance">
          {course.name}
        </h2>
        {course.description && (
          <p className="type-body text-text-muted max-w-reading m-0">{course.description}</p>
        )}
        <Workshops course={course} t={t} />
        <Load course={course} t={t} />
        <p className="type-caption text-text-muted m-0 flex flex-wrap items-center gap-2">
          <Badge variant={course.free ? 'success' : 'neutral'}>
            {priceLabel(course, t, format)}
          </Badge>
          {t('availableUntil', { date: untilOf(course, format) })}
        </p>
        <div className="pt-2">
          <Action course={course} contact={contact} requested={requested} t={t} />
        </div>
      </div>
      <Cover course={course} className="order-first h-full md:order-last md:aspect-auto" />
    </section>
  );
}

export async function CatalogSection({
  courses,
  contact,
  requested = {},
  title,
}: {
  courses: CatalogCourse[];
  contact: CatalogContact;
  /** Cursos de pago ya pedidos: `cohortId` → ISO (6/10). */
  requested?: Record<string, PendingEnroll>;
  /** Otro título cuando va debajo del destacado («Más cursos»). */
  title?: string;
}) {
  if (courses.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations('learn.catalog'), getFormatter()]);

  // Un grupo por cohorte (su programa con fechas), en el orden en que llegan: gratuitos primero.
  const groups = new Map<string, CatalogCourse[]>();
  for (const course of courses) {
    const list = groups.get(course.cohortId) ?? [];
    list.push(course);
    groups.set(course.cohortId, list);
  }

  return (
    <PageSection id="cursos-abiertos" title={title ?? t('title')} description={t('hint')}>
      <div className="space-y-8">
        {[...groups.entries()].map(([cohortId, items]) => {
          const [first] = items;
          if (!first) return null;
          const groupId = `programa-${cohortId}`;
          const pending = requested[cohortId];
          const wa = pending
            ? whatsappUrl(
                contact.phone,
                t('requestMessage', { name: contact.name, course: first.programName })
              )
            : null;
          return (
            <section key={cohortId} aria-labelledby={groupId} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h3 id={groupId} className="type-body-emphasis text-text m-0">
                    {first.programName}
                  </h3>
                  <p className="type-caption text-text-muted m-0">
                    {t('groupMeta', {
                      count: first.programModules,
                      date: untilOf(first, format),
                    })}
                  </p>
                </div>
              </div>
              {pending && (
                <div className="bg-surface-sunken rounded-control flex flex-wrap items-center justify-between gap-3 p-3">
                  <p className="type-caption text-text m-0 flex items-start gap-2">
                    <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
                    {t('groupRequested', {
                      date: format.dateTime(new Date(pending.at), {
                        day: 'numeric',
                        month: 'long',
                      }),
                      module:
                        items.find((c) => c.moduleId === pending.moduleId)?.name ?? first.name,
                    })}
                  </p>
                  {/* El mismo atajo que se ofrece al pedir: escribir ya, con el mensaje hecho. */}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="type-label text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                    >
                      {t('writeUs')}
                      <span className="sr-only"> {t('newTab')}</span>
                    </a>
                  )}
                </div>
              )}
              <ul
                className={cn(
                  // `items-start`: abrir «Ver talleres» en una tarjeta no estira la de al lado.
                  // Columnas de ancho fijo (`auto-fill`): la tarjeta mide igual en todos los grupos; en el
                  // teléfono, una a todo el ancho.
                  'motion-stagger m-0 grid list-none items-start gap-4 p-0',
                  'sm:grid-cols-[repeat(auto-fill,17.5rem)]'
                )}
              >
                {items.map((course) => (
                  <li key={course.moduleId} className="min-w-0">
                    <CourseCard course={course} contact={contact} requested={requested} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageSection>
  );
}
