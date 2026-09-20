'use client';

/**
 * La lista y el "marcar leída". Compartida por el centro de staff (`/notificaciones`) y el
 * del estudiante (`/aprender/notificaciones`) desde el 19/9: el servicio es el mismo.
 * SSOT: plan/11-ux.md:77-80.
 *
 * Lo leído y lo no leído se distinguen por **texto** ("Sin leer") y por peso, no solo por
 * un fondo distinto: el color no puede ser el único portador del estado
 * (DESIGN.md §Color semántico).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Fecha y hora en Bogotá: el servidor corre en UTC y la gente vive aquí. */
const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export function NotificationList({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (url: string, id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(url, { method: 'PATCH' });
      if (!res.ok) {
        setError(t('markError'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('markError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error !== null && <Alert severity="error">{error}</Alert>}

      {unread > 0 && (
        <Button
          type="button"
          variant="secondary"
          loading={busy === 'all'}
          disabled={busy !== null}
          onClick={() => void send('/api/notifications/read-all', 'all')}
        >
          {t('markAllRead')}
        </Button>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const isUnread = item.readAt === null;

          return (
            <li
              key={item.id}
              className={`border-border rounded-card border p-4 ${
                isUnread ? 'bg-surface-base' : 'bg-surface-canvas'
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3
                  className={
                    isUnread ? 'type-body-emphasis text-text' : 'type-body text-text-muted'
                  }
                >
                  {item.title}
                </h3>
                {isUnread && (
                  <span className="type-overline text-text-muted uppercase">{t('unreadTag')}</span>
                )}
                <time dateTime={item.createdAt} className="type-caption text-text-muted">
                  {formatWhen(item.createdAt)}
                </time>
              </div>

              <p className="type-body text-text max-w-reading mt-1">{item.body}</p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                {item.href && (
                  <Link
                    href={item.href}
                    className="type-body text-text-link min-h-touch flex items-center underline"
                  >
                    {t('open')}
                  </Link>
                )}
                {isUnread && (
                  <Button
                    type="button"
                    variant="quiet"
                    loading={busy === item.id}
                    disabled={busy !== null}
                    onClick={() => void send(`/api/notifications/${item.id}/read`, item.id)}
                  >
                    {t('markRead')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
