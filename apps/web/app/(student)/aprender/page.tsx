/**
 * La ruta del programa: mi cohorte, módulo a módulo.
 * SSOT: reference/01-routing/routes.md:27, plan/08-aprender-y-evaluar.md:12-19.
 *
 * Server Component entero y sin JavaScript de cliente: es una lista de enlaces con su
 * estado. El acordeón es `<details>`, que abre y cierra con teclado sin que nadie escriba
 * nada, y que funciona aunque el JavaScript falle — que en un celular de gama media con
 * datos limitados pasa.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import type { SequencedItem } from '@/features/learn/server/outline';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Alert } from '@/components/atoms/alert';

export const metadata: Metadata = { title: 'Aprender' };

export default async function LearnPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const outline = await getCohortOutline({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

  // Los estados terminales tienen pantalla propia: enseñar una ruta que no se puede recorrer
  // es peor que explicar por qué.
  if (outline.gate) {
    return (
      <Page>
        <PageHeader
          overline={outline.cohort?.programName}
          title={t('title')}
          description={
            outline.cohort ? `${outline.cohort.code} — ${outline.cohort.name}` : undefined
          }
        />
        <EmptyState
          title={t(`gate.${outline.gate.kind}.title`)}
          description={t(`gate.${outline.gate.kind}.body`, {
            date:
              'startsOn' in outline.gate
                ? outline.gate.startsOn
                : 'accessUntil' in outline.gate
                  ? outline.gate.accessUntil
                  : '',
          })}
          supportEmail={ctx.institution.supportEmail}
        />
        {/* Con el acceso vencido o el programa terminado, lo que queda son los resultados
            (routes.md:31: «+ enlace a resultados»). */}
        {(outline.gate.kind === 'ACCESS_EXPIRED' || outline.gate.kind === 'COMPLETED') && (
          <p className="type-body">
            <Link
              href="/aprender/resultados"
              className="text-text-link min-h-touch inline-flex items-center underline"
            >
              {t('goToResults')}
            </Link>
          </p>
        )}
      </Page>
    );
  }

  const { cohort, modules, resume, progress } = outline;

  return (
    <Page>
      <PageHeader
        overline={cohort?.programName}
        title={t('title')}
        description={t('progress', { completed: progress.completed, total: progress.total })}
      />

      {/* Decisión 8: se dice que la financia una entidad aliada, sin nombrarla. */}
      {outline.partnerFunded && <Alert severity="info">{t('partnerFunded')}</Alert>}

      {resume && (
        <PageSection title={t('resumeTitle')} id="continuar">
          <Link
            href={hrefFor(resume)}
            className="type-body-emphasis text-text-link min-h-touch inline-flex items-center underline"
          >
            {t('resumeAction', { title: resume.title })}
          </Link>
        </PageSection>
      )}

      <PageSection title={t('outlineTitle')} id="ruta">
        {modules.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
        ) : (
          <div className="space-y-3">
            {modules.map((module) => (
              <details key={module.id} open className="border-border rounded-card border p-4">
                <summary className="type-subheading text-text min-h-touch flex cursor-pointer items-center">
                  {module.name}
                </summary>
                {module.items.length === 0 ? (
                  <p className="type-body text-text-muted mt-2">{t('moduleEmpty')}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {module.items.map((item) => (
                      <li key={item.assignmentId}>
                        <ItemRow item={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  );
}

const hrefFor = (item: SequencedItem) =>
  item.kind === 'LESSON'
    ? `/aprender/tema/${item.assignmentId}`
    : `/aprender/evaluacion/${item.assignmentId}`;

/**
 * Una fila de la ruta.
 *
 * El estado va en **texto** además de en el estilo, y lo bloqueado no es un enlace: un
 * enlace que no lleva a ninguna parte se anuncia como enlace y frustra a quien lo pulsa.
 */
async function ItemRow({ item }: { item: SequencedItem }) {
  const t = await getTranslations('learn');

  const label = [
    t(`status.${item.status}`),
    item.kind === 'ASSESSMENT' ? t('isAssessment') : null,
    item.requiresSubmission ? t('needsSubmission') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!item.enabled) {
    return (
      <div className="border-border bg-surface-sunken rounded-control border p-3">
        <p className="type-body text-text-muted">{item.title}</p>
        <p className="type-caption text-text-muted">
          {item.blockedBy
            ? t('blockedBy', { title: item.blockedBy })
            : item.unavailableReason === 'NOT_YET'
              ? t('notYet')
              : t('closed')}
        </p>
      </div>
    );
  }

  return (
    <Link
      href={hrefFor(item)}
      className="border-border bg-surface-base hover:bg-surface-sunken min-h-touch rounded-control block border p-3"
    >
      <span className="type-body-emphasis text-text-link block underline">{item.title}</span>
      <span className="type-caption text-text-muted block">{label}</span>
    </Link>
  );
}
