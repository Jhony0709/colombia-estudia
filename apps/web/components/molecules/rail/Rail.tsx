/**
 * Carril lateral del panel (19/9): tarjetas de contexto a la derecha de una lista en
 * pantallas anchas (`xl`), debajo en las demás. `RailCard` es la tarjeta con su título;
 * `ActivityFeed` la lista de «qué pasó», ya traducida por quien la usa.
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function RailCard({
  id,
  title,
  icon: Icon,
  tone = 'muted',
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone?: 'muted' | 'warning' | 'info';
  children: ReactNode;
}) {
  const color = {
    muted: 'text-text-muted',
    warning: 'text-status-warning-base',
    info: 'text-status-info-base',
  }[tone];
  return (
    <section
      aria-labelledby={id}
      className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-3 border p-5"
    >
      <h2 id={id} className="type-body-emphasis text-text flex items-center gap-2">
        <Icon aria-hidden="true" className={`size-4 ${color}`} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface ActivityFeedItem {
  id: string;
  label: string;
  occurredAt: Date;
  /** Fecha ya formateada (la formatea quien conoce el locale del servidor). */
  when: string;
  actorName: string | null;
}

export function ActivityFeed({
  items,
  empty,
  by,
}: {
  items: ActivityFeedItem[];
  empty: string;
  by: (name: string) => string;
}) {
  if (items.length === 0) return <p className="type-caption text-text-muted m-0">{empty}</p>;
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {items.map((a) => (
        <li key={a.id} className="space-y-0.5">
          <p className="type-body text-text m-0">{a.label}</p>
          <p className="type-caption text-text-muted m-0">
            <time dateTime={a.occurredAt.toISOString()}>{a.when}</time>
            {a.actorName && <> · {by(a.actorName)}</>}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Rejilla lista + carril: el carril mide 20rem y solo va al lado desde `xl`. */
export function WithRail({
  children,
  rail,
  railLabel,
}: {
  children: ReactNode;
  rail: ReactNode;
  railLabel: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">{children}</div>
      <aside aria-label={railLabel} className="min-w-0 space-y-6">
        {rail}
      </aside>
    </div>
  );
}
