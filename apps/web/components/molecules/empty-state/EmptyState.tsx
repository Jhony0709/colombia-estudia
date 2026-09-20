/**
 * EmptyState molecule.
 * SSOT: plan/11-ux.md:13-14 ("Nunca una pantalla en blanco"), DESIGN.md §Estados vacíos.
 *
 * Three things, always: what is not there, what to do about it, and who to write to when
 * doing it is not possible. A bare "No hay datos" is the pattern this component exists to
 * make impossible.
 */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** What is not here, in one line. */
  title: string;
  /** What to do about it. */
  description?: string;
  /** The one action that resolves it, when there is one. */
  action?: ReactNode;
  /** Institution's support address, so the screen never dead-ends. */
  supportEmail?: string;
}

export function EmptyState({ title, description, action, supportEmail }: EmptyStateProps) {
  return (
    <div className="bg-surface-sunken rounded-card space-y-3 p-6">
      <p className="type-body-emphasis text-text">{title}</p>
      {description && <p className="type-body text-text-muted">{description}</p>}
      {action}
      {supportEmail && (
        <p className="type-caption text-text-muted">
          ¿Algo no cuadra? Escribe a{' '}
          <a href={`mailto:${supportEmail}`} className="text-text-link underline">
            {supportEmail}
          </a>
          .
        </p>
      )}
    </div>
  );
}
