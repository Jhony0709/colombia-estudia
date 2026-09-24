'use client';

/**
 * La lista y el "marcar leída". Compartida por el centro de staff (`/notificaciones`) y el
 * del estudiante (`/aprender/notificaciones`) desde el 19/9: el servicio es el mismo.
 * SSOT: plan/11-ux.md:77-80.
 *
 * Lo leído y lo no leído se distinguen por **texto** ("Sin leer") y por peso, no solo por
 * un fondo distinto: el color no puede ser el único portador del estado
 * (DESIGN.md §Color semántico).
 *
 * E4 (23/9, docs/ux/decision-estudiante-2309.md): cada aviso lleva **una** acción contextual
 * con nombre propio («Ver la nota», «Revisar el pago»…) en vez de un «Ver» genérico, y la
 * lista se agrupa por día (Hoy, Ayer, fecha) para que el estudiante sepa qué es reciente sin
 * leer cada fecha. En el feed no hay acciones irreversibles: marcar leída es lo único que se
 * hace aquí; pagar, enviar o firmar ocurre en la pantalla de destino.
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

const TIME_ZONE = 'America/Bogota';

/** Hora en Bogotá: el servidor corre en UTC y la gente vive aquí. El día va en el encabezado. */
const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: TIME_ZONE,
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(iso));

/** Clave de día en Bogotá («2026-09-23»): `en-CA` da ISO sin construir fechas a mano. */
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));

/**
 * La acción que abre cada tipo de aviso. Una sola por aviso y con nombre propio: el
 * estudiante sabe a dónde va antes de tocar. Los tipos son los que emiten los servicios
 * (`db.notification.create({ type })`); un tipo sin entrada cae en «Ver».
 */
const ACTION_BY_TYPE: Record<string, string> = {
  attempt_graded: 'viewGrade',
  lesson_reopened: 'goToLesson',
  live_session_soon: 'viewSession',
  certificate_issued: 'viewCertificate',
  payment_confirmed: 'viewAccount',
  payment_failed: 'reviewPayment',
  overdue_reminder: 'reviewPayment',
  agreement_signed: 'viewAgreement',
  agreement_overdue: 'reviewPayment',
  submission_approved: 'viewLesson',
  submission_returned: 'fixSubmission',
  submission_received: 'reviewSubmissions',
  problem_reported: 'viewLesson',
  reinvite_requested: 'viewPerson',
};

interface DayGroup {
  key: string;
  label: 'today' | 'yesterday' | 'date';
  first: string;
  items: NotificationItem[];
}

/** Agrupa en el orden en que llegan (el servicio ya los manda del más nuevo al más viejo). */
const groupByDay = (items: NotificationItem[], now: Date): DayGroup[] => {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = dayKey(new Date(item.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key,
      label: key === today ? 'today' : key === yesterday ? 'yesterday' : 'date',
      first: item.createdAt,
      items: [item],
    });
  }
  return groups;
};

export function NotificationList({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = groupByDay(items, new Date());

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

      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`day-${group.key}`} className="space-y-3">
          {/*
            `suppressHydrationWarning`: «Hoy» depende del reloj de quien pinta; en la
            medianoche el servidor y el navegador pueden estar en días distintos.
          */}
          <h3
            id={`day-${group.key}`}
            className="type-overline text-text-muted uppercase"
            suppressHydrationWarning
          >
            {group.label === 'date' ? formatDay(group.first) : t(`groups.${group.label}`)}
          </h3>

          <ul className="space-y-3">
            {group.items.map((item) => {
              const isUnread = item.readAt === null;
              const actionKey = ACTION_BY_TYPE[item.type];

              return (
                <li
                  key={item.id}
                  className={`border-border rounded-card border p-4 ${
                    isUnread ? 'bg-surface-base' : 'bg-surface-canvas'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4
                      className={
                        isUnread ? 'type-body-emphasis text-text' : 'type-body text-text-muted'
                      }
                    >
                      {item.title}
                    </h4>
                    {isUnread && (
                      <span className="type-overline text-text-muted uppercase">
                        {t('unreadTag')}
                      </span>
                    )}
                    {/*
                      `suppressHydrationWarning` (23/9): el mismo `Intl.DateTimeFormat` da
                      espacio fino (U+202F) en el navegador y espacio normal en Node, y React lo
                      trataba como desajuste de hidratación y volvía a pintar el árbol entero.
                    */}
                    <time
                      dateTime={item.createdAt}
                      className="type-caption text-text-muted"
                      suppressHydrationWarning
                    >
                      {formatTime(item.createdAt)}
                    </time>
                  </div>

                  <p className="type-body text-text max-w-reading mt-1">{item.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {item.href && (
                      <Link
                        href={item.href}
                        className="type-body text-text-link min-h-touch flex items-center underline"
                      >
                        {actionKey ? t(`actions.${actionKey}`) : t('open')}
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
        </section>
      ))}
    </div>
  );
}
