/**
 * Un intento: en curso (preguntas, autosave, reloj) o cerrado (resultado según la política).
 * SSOT: reference/01-routing/routes.md:33, plan/08-aprender-y-evaluar.md:47-70.
 *
 * Server Component que carga el intento —cerrándolo por plazo si toca— y se lo da al
 * `AttemptPlayer`. Todo lo que cambia el estado vuelve a pasar por aquí con
 * `router.refresh()`: la pantalla de resultado no la construye el cliente.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { APIError } from '@/lib/core/errors';
import { getRequestContext } from '@/lib/authz/request-context';
import { getAttemptForStudent } from '@/features/learn/server/attempt.service';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { AttemptPlayer } from '@/components/organisms/attempt-player';
import { TaskBar, TaskMode } from '@/components/organisms/task-mode';

export const metadata: Metadata = { title: 'Intento' };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ assignmentId: string; attemptId: string }>;
}) {
  const { assignmentId, attemptId } = await params;
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const ta = await getTranslations('learn.attempt');

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  let attempt;
  try {
    attempt = await getAttemptForStudent({
      institutionId: ctx.institution.id,
      personId: ctx.person.id,
      attemptId,
    });
  } catch (e) {
    if (e instanceof APIError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  // La URL lleva la asignación por legibilidad; la verdad es la del intento.
  if (attempt.assignmentId !== assignmentId) notFound();

  return (
    <Page>
      {/* Modo tarea (E2, 23/9): en el teléfono, sin barra global mientras se presenta. */}
      <TaskMode />
      <TaskBar
        backHref={`/aprender/examen/${attempt.assignmentId}`}
        backLabel={ta('backToAssessment')}
        place={`${ta('attemptNumber', { number: attempt.number })} · ${attempt.title}`}
      />
      <PageHeader
        overline={ta('attemptNumber', { number: attempt.number })}
        title={attempt.title}
        back={
          <Link
            href={`/aprender/examen/${attempt.assignmentId}`}
            className="text-text-link min-h-touch inline-flex items-center underline"
          >
            {ta('backToAssessment')}
          </Link>
        }
      />
      <AttemptPlayer attempt={attempt} />
    </Page>
  );
}
