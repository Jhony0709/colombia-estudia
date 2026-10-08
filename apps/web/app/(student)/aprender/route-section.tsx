/**
 * La ruta de una matrícula (movida de `/aprender` el 7/10, Jhonny: «no debería verse en
 * /aprender, sino en la página de los detalles del curso»): componentes como acordeón, el
 * actual abierto, cada ítem con su estado, y «Pedir que lo habiliten» en el siguiente bloqueado.
 * La usa `/aprender/curso/[enrollmentId]`.
 */

import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, CircleCheck, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CohortOutline, OutlineModule } from '@/features/learn/server/cohort.service';
import { workshopStart, type SequencedItem } from '@/features/learn/server/outline';
import { PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { FORM_ICONS, formOf, hrefFor, itemMeta } from './route-rail';
import { UnlockRequestButton } from './unlock-request-button';

/** La ruta del programa elegido, o por qué no se puede recorrer. */
export async function RouteSection({
  outline,
  supportEmail,
  requested,
  title: titleProp,
}: {
  outline: CohortOutline;
  supportEmail?: string;
  /** Solicitudes abiertas, `enrollmentId:moduleId` → ISO (6/10). */
  requested: Record<string, string>;
  /** Otro título cuando la página ya nombra el programa. */
  title?: string;
}) {
  const t = await getTranslations('learn');
  const { cohort, modules, resume, upcoming, gate } = outline;
  const title =
    titleProp ?? (cohort ? t('routeOf', { program: cohort.programName }) : t('outlineTitle'));
  // La ruta resumida, no escondida (E2, 23/9): abierto el módulo por el que se va (el del
  // ítem a retomar, o el del primero sin completar, o el primero), los demás en una línea
  // con «x de y · min». Si todo está completo, abierto el último.
  const currentModuleId = (resume ?? upcoming)?.moduleId ?? modules[modules.length - 1]?.id ?? null;
  const firstLockedId = modules.find((m) => m.access.state === 'LOCKED')?.id ?? null;

  // Los estados terminales tienen pantalla propia: enseñar una ruta que no se puede recorrer
  // es peor que explicar por qué.
  if (gate) {
    return (
      <PageSection title={title} id="ruta">
        <EmptyState
          title={t(`gate.${gate.kind}.title`)}
          description={t(`gate.${gate.kind}.body`, {
            date:
              'startsOn' in gate ? gate.startsOn : 'accessUntil' in gate ? gate.accessUntil : '',
          })}
          supportEmail={supportEmail}
        />
      </PageSection>
    );
  }

  return (
    <PageSection title={title} id="ruta">
      {modules.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <ModuleBlock
              key={module.id}
              module={module}
              resumeId={resume?.assignmentId ?? null}
              current={module.id === currentModuleId}
              // Solo el siguiente bloqueado se pide (6/10): pedir los de más adelante es ruido.
              request={
                outline.enrollmentId && module.id === firstLockedId
                  ? {
                      enrollmentId: outline.enrollmentId,
                      requestedAt: requested[`${outline.enrollmentId}:${module.id}`] ?? null,
                    }
                  : null
              }
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}

/** Lo que el módulo cuesta y cómo va: «3 de 8 · 52 min». Los minutos, si algún ítem los trae. */
function summarize(items: SequencedItem[]) {
  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const minutes = items.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  return { completed, total: items.length, minutes };
}

/**
 * Un módulo de la ruta como línea (27/9, del diseño aprobado): una superficie por componente
 * —nombre, «4 de 8 · 60 min», barra— y debajo los ítems unidos por una línea vertical con un
 * punto por estado: completado (check verde), actual (punto de acento y fondo tintado),
 * disponible (aro neutro) y bloqueado (candado). Sin borde por ítem: el ritmo lo da la línea.
 *
 * Cerrado si está bloqueado entero (ningún ítem habilitado y el primero espera a otro tema):
 * abrirlo solo enseñaría una lista de «se habilita al…». Lo que sigue al ítem actual y a su
 * siguiente va en «Ver N restantes», plegado: en el teléfono, ocho filas eran dos pantallas.
 */
async function ModuleBlock({
  module,
  resumeId,
  current,
  request,
}: {
  module: OutlineModule;
  resumeId: string | null;
  /** El módulo por el que se va (E2, 23/9): el único que se abre; los demás, resumidos. */
  current: boolean;
  /** El siguiente bloqueado (6/10): se puede pedir que lo habiliten. */
  request: { enrollmentId: string; requestedAt: string | null } | null;
}) {
  const [t, format] = await Promise.all([getTranslations('learn'), getFormatter()]);
  const { completed, total, minutes } = summarize(module.items);
  const first = module.items[0];
  // Cerrado por el componente (3/10: operación no lo ha habilitado, o está fuera de sus
  // fechas) o por secuencia (ningún ítem habilitado y el primero espera a otro tema).
  const { access } = module;
  const closed = access.state !== 'OPEN';
  const locked =
    closed ||
    (module.items.length > 0 && module.items.every((item) => !item.enabled) && !!first?.blockedBy);
  const lockedText =
    access.state === 'LOCKED'
      ? t('moduleAccess.LOCKED')
      : access.state === 'NOT_YET'
        ? t('moduleAccess.NOT_YET', { date: format.dateTime(access.from, { dateStyle: 'long' }) })
        : access.state === 'CLOSED'
          ? t('moduleAccess.CLOSED', { date: format.dateTime(access.until, { dateStyle: 'long' }) })
          : first?.blockedBy
            ? t('moduleLocked', { title: first.blockedBy })
            : null;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Lo visible sin plegar: hasta el ítem actual (o el primero sin completar) y uno más.
  const focusIndex = Math.max(
    module.items.findIndex((item) => item.assignmentId === resumeId),
    module.items.findIndex((item) => item.status !== 'COMPLETED')
  );
  const visibleUntil = focusIndex < 0 ? module.items.length : focusIndex + 2;
  const shown = module.items.slice(0, visibleUntil);
  const rest = module.items.slice(visibleUntil);
  const firstBlockedId = module.items.find((i) => !i.enabled)?.assignmentId ?? null;

  // El taller (asignatura) como cabecera de grupo cuando cambia (3/10): «Lengua castellana»,
  // y debajo sus temas y su cuestionario.
  const workshop = (item: SequencedItem) => workshopStart(module.items, module.items.indexOf(item));

  const row = (item: SequencedItem, index: number, last: boolean) => (
    <li key={item.assignmentId} className="relative pl-9">
      {workshop(item) && (
        <p className="type-overline text-text-muted mb-2 mt-3 first:mt-0">{workshop(item)}</p>
      )}
      {/* La línea entre puntos; el último no la lleva. */}
      {!last && (
        <span
          aria-hidden
          className={cn(
            'bg-border-muted absolute left-[0.6875rem] w-0.5',
            workshop(item) ? 'top-[3.875rem] h-[calc(100%-2.75rem)]' : 'top-8 h-[calc(100%-0.5rem)]'
          )}
        />
      )}
      <StatusDot item={item} isResume={item.assignmentId === resumeId} offset={!!workshop(item)} />
      <ItemRow
        item={item}
        isResume={item.assignmentId === resumeId}
        showReason={item.assignmentId === firstBlockedId}
        nested={item.kind === 'ASSESSMENT' && !!item.lessonId}
      />
    </li>
  );

  return (
    <div
      className={cn(
        'bg-surface-base rounded-card elevation-resting p-4 sm:p-5',
        locked && 'bg-surface-sunken'
      )}
    >
      <details open={current && !locked}>
        <summary className="min-h-touch flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2">
          {/* La portada del componente (3/10), decorativa; en gris cuando está bloqueado. */}
          {module.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
            <img
              src={module.coverUrl}
              alt=""
              className={cn(
                'bg-surface-sunken rounded-control size-12 shrink-0 object-cover',
                locked && 'opacity-60 grayscale'
              )}
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="type-subheading text-text inline-flex items-center gap-2">
              {locked ? (
                <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
              ) : completed === total && total > 0 ? (
                <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
              ) : null}
              {module.name}
            </span>
            {(total > 0 || closed) && (
              <span className="type-caption text-text-muted block">
                {locked && lockedText
                  ? lockedText
                  : t('moduleSummary', { completed, total, minutes })}
              </span>
            )}
          </span>
          {total > 0 && !locked && (
            <span className="flex w-40 items-center gap-2">
              <ProgressBar
                percent={percent}
                label={t('rail.progressLabel', { module: module.name })}
                className="flex-1"
              />
              <span className="type-caption text-text-muted whitespace-nowrap tabular-nums">
                {percent} %
              </span>
            </span>
          )}
        </summary>
        {/* De qué va el componente (25/9), si el equipo lo escribió. */}
        {module.description && (
          <p className="type-body text-text-muted max-w-reading mt-3">{module.description}</p>
        )}
        {module.items.length === 0 ? (
          <p className="type-body text-text-muted mt-2">{t('moduleEmpty')}</p>
        ) : (
          <>
            <ul className="m-0 mt-4 list-none space-y-1 p-0">
              {shown.map((item, index) =>
                row(item, index, rest.length === 0 && index === shown.length - 1)
              )}
            </ul>
            {rest.length > 0 && (
              <details className="mt-1">
                <summary className="type-caption text-text-link min-h-touch flex cursor-pointer items-center gap-2 pl-9">
                  {t('showRest', { count: rest.length })}
                </summary>
                <ul className="m-0 mt-1 list-none space-y-1 p-0">
                  {rest.map((item, index) => row(item, index, index === rest.length - 1))}
                </ul>
              </details>
            )}
          </>
        )}
      </details>
      {/* Fuera del `summary`: un botón dentro de él también abriría y cerraría el bloque. */}
      {request && (
        <div className="mt-3">
          <UnlockRequestButton
            enrollmentId={request.enrollmentId}
            moduleId={module.id}
            moduleName={module.name}
            requestedAt={request.requestedAt}
          />
        </div>
      )}
    </div>
  );
}

/** El punto de la línea: uno por estado, y siempre con icono, no solo color. */
function StatusDot({
  item,
  isResume,
  offset = false,
}: {
  item: SequencedItem;
  isResume: boolean;
  /** Con cabecera de taller encima, el punto baja a la altura de la fila. */
  offset?: boolean;
}) {
  const base = cn(
    'absolute left-0 inline-flex size-6 items-center justify-center rounded-full',
    offset ? 'top-[2.625rem]' : 'top-3'
  );
  if (item.status === 'COMPLETED') {
    return (
      <span aria-hidden className={cn(base, 'bg-status-success-muted text-status-success-base')}>
        <CircleCheck className="size-4" />
      </span>
    );
  }
  if (isResume) {
    return (
      <span aria-hidden className={cn(base, 'bg-accent-base text-text-on-accent')}>
        <Play className="size-3 fill-current" />
      </span>
    );
  }
  if (!item.enabled) {
    return (
      <span aria-hidden className={cn(base, 'bg-surface-sunken text-text-muted')}>
        <Lock className="size-3.5" />
      </span>
    );
  }
  return <span aria-hidden className={cn(base, 'border-border bg-surface-base border-2')} />;
}

/**
 * Una fila de la ruta: forma, título, «Vídeo · 12 min · Completado». El estado va en
 * **texto** además de en el punto, y lo bloqueado no es un enlace: un enlace que no lleva a
 * ninguna parte se anuncia como enlace y frustra a quien lo pulsa. La fila actual va sobre
 * fondo tintado con su «Continuar»: es la única acción que hay que encontrar sin buscar.
 */
async function ItemRow({
  item,
  isResume,
  showReason,
  nested,
}: {
  item: SequencedItem;
  isResume: boolean;
  /** Decir por qué está bloqueado; los siguientes de la misma fila de bloqueados no lo repiten. */
  showReason: boolean;
  /** El examen de un tema (20/9) va justo debajo de su tema, un poco metido. */
  nested: boolean;
}) {
  const t = await getTranslations('learn');
  const Icon = FORM_ICONS[formOf(item)];
  const label = `${itemMeta(item, t)} · ${t(`status.${item.status}`)}`;

  if (!item.enabled) {
    const reason = item.blockedBy
      ? t('blockedBy', { title: item.blockedBy })
      : item.unavailableReason === 'NOT_YET'
        ? t('notYet')
        : item.unavailableReason === 'LOCKED'
          ? t('lockedModule')
          : t('closed');
    return (
      <div className={cn('rounded-control flex items-start gap-3 px-3 py-2', nested && 'ml-4')}>
        <Icon aria-hidden className="text-text-subtle mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="type-body text-text-muted m-0">{item.title}</p>
          <p className="type-caption text-text-muted m-0">
            {label}
            {showReason ? ` · ${reason}` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={hrefFor(item)}
      className={cn(
        'hover:bg-surface-sunken rounded-control min-h-touch flex items-center gap-3 px-3 py-2',
        nested && 'ml-4',
        isResume && 'bg-status-info-muted hover:bg-status-info-muted'
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-5 shrink-0', isResume ? 'text-status-info-base' : 'text-text-muted')}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'type-body block',
            isResume
              ? 'type-body-emphasis text-text-link'
              : item.status === 'COMPLETED'
                ? 'text-text-muted'
                : 'text-text'
          )}
        >
          {item.title}
        </span>
        <span className="type-caption text-text-muted block">{label}</span>
      </span>
      {isResume && (
        <span className="type-label bg-accent-base text-text-on-accent rounded-control inline-flex shrink-0 items-center gap-1 px-3 py-1.5">
          {item.status === 'IN_PROGRESS' ? t('continueLabel') : t('startLabel')}
          <ArrowRight aria-hidden className="size-3.5" />
        </span>
      )}
    </Link>
  );
}
