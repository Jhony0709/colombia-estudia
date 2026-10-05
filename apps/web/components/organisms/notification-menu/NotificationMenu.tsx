'use client';

/**
 * La campana de la barra del estudiante y del acudiente (5/10).
 *
 * Al abrir pide los últimos avisos y marca leídos los que llegaron sin leer; «Ver todas»
 * lleva al centro de notificaciones. Mientras el menú sigue abierto, esos avisos conservan
 * la marca de nuevos: ya están leídos en la base, pero la persona tiene que ver cuáles eran.
 */

import { useEffect, useRef, useState } from 'react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, Bell } from 'lucide-react';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import type { NotificationItem } from '@/components/organisms/notification-list';
import { cn } from '@/lib/utils';

const LIMIT = 6;
const TIME_ZONE = 'America/Bogota';

type Load =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: NotificationItem[] };

const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });
const shortDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

/** «hace 5 minutos», «ayer», «3 oct». Solo se pinta en el cliente: no hay hidratación. */
const ago = (iso: string, now: number, justNow: string) => {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return justNow;
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day');
  return shortDate.format(new Date(iso));
};

export function NotificationMenu({ href, unread }: { href: string; unread: number }) {
  const t = useTranslations('notifications.menu');
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [count, setCount] = useState(unread);
  const turn = useRef(0);

  useEffect(() => setCount(unread), [unread]);

  const refresh = async () => {
    const mine = ++turn.current;
    // Lo de la vez anterior se queda a la vista mientras llega lo nuevo.
    setLoad((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    try {
      const res = await fetch(`/api/notifications?limit=${LIMIT}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as {
        data?: { items: NotificationItem[]; unread: number };
      };
      if (mine !== turn.current) return;
      const items = payload.data?.items ?? [];
      setLoad({ status: 'ready', items });
      setCount(payload.data?.unread ?? 0);

      const fresh = items.filter((item) => item.readAt === null);
      if (fresh.length === 0) return;
      const results = await Promise.allSettled(
        fresh.map((item) =>
          fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PATCH' })
        )
      );
      const marked = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
      if (marked === 0) return;
      setCount((current) => Math.max(0, current - marked));
      // El contador del layout y el centro de notificaciones, si está abierto, se ponen al día.
      router.refresh();
    } catch {
      if (mine === turn.current) setLoad({ status: 'error' });
    }
  };

  const now = Date.now();
  const notice = (text: string) => (
    <DropdownItem disabled className="type-caption">
      {text}
    </DropdownItem>
  );

  return (
    <Dropdown onOpenChange={(open) => open && void refresh()}>
      <DropdownTrigger>
        <button
          type="button"
          aria-label={count > 0 ? t('unreadLabel', { count }) : t('label')}
          className="text-text-muted hover:bg-surface-sunken hover:text-text data-[state=open]:bg-surface-sunken data-[state=open]:text-text rounded-control min-h-touch min-w-touch relative inline-flex items-center justify-center"
        >
          <Bell className="size-5" aria-hidden="true" />
          {count > 0 && (
            <span
              aria-hidden="true"
              className="bg-accent-base text-text-on-accent type-caption absolute -right-0.5 -top-0.5 min-w-5 rounded-full px-1 text-center"
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label={t('label')} className="w-[min(24rem,calc(100vw-1rem))]">
        <DropdownSection title={t('title')}>
          {load.status === 'loading' && notice(t('loading'))}
          {load.status === 'error' && notice(t('error'))}
          {load.status === 'ready' && load.items.length === 0 && notice(t('empty'))}
          {load.status === 'ready' &&
            load.items.map((item) => {
              const isNew = item.readAt === null;
              return (
                <DropdownItem
                  key={item.id}
                  itemKey={item.id}
                  multiline
                  startContent={
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-2 size-2 rounded-full',
                        isNew ? 'bg-accent-base' : 'bg-transparent'
                      )}
                    />
                  }
                  description={
                    <>
                      <span className="line-clamp-2 block">{item.body}</span>
                      <time dateTime={item.createdAt} className="mt-0.5 block">
                        {ago(item.createdAt, now, t('justNow'))}
                      </time>
                    </>
                  }
                  onSelect={() => router.push((item.href ?? href) as Route)}
                >
                  {isNew && <span className="sr-only">{t('new')}: </span>}
                  <span className={isNew ? 'type-body-emphasis' : undefined}>{item.title}</span>
                </DropdownItem>
              );
            })}
        </DropdownSection>
        <DropdownSeparator />
        <DropdownItem
          itemKey="all"
          endContent={<ArrowRight className="text-text-muted size-4" aria-hidden="true" />}
          onSelect={() => router.push(href as Route)}
        >
          {t('viewAll')}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
