import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Badge,
  Button,
  EmptyState,
  ListItem,
  Message,
  Skeleton,
  Stack,
  Swap,
  Text,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { follow } from '../links';
import { listNotifications, markAllRead, markRead, type Notice } from './api';
import { setUnread } from './unread';

const t = copy.notifications;

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Por día, en el orden en que llegan, como NotificationList.tsx de la web (`groupByDay`). */
function byDay(items: Notice[], now = new Date()) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const groups: { key: string; label: string; items: Notice[] }[] = [];
  for (const item of items) {
    const created = new Date(item.createdAt);
    const key = dayKey(created);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const label =
      key === today
        ? t.today
        : key === yesterday
          ? t.yesterday
          : created.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    groups.push({ key, label, items: [item] });
  }
  return groups;
}

/** Notificaciones (reference/03-ui/movil.md, M2). */
export function Notifications() {
  const [data, setData] = useState<{ items: Notice[]; unread: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);

  const load = useCallback(
    () =>
      listNotifications().then(
        (next) => {
          setData(next);
          setUnread(next.unread);
          setFailed(false);
        },
        (error: unknown) => {
          setFailed(true);
          throw error;
        }
      ),
    []
  );
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  /** Lo pulsado espera; si el servidor no marca, se dice y no se abre. */
  async function mark(action: () => Promise<unknown>) {
    setMarkFailed(false);
    try {
      await action();
    } catch (error) {
      setMarkFailed(true);
      throw error;
    }
    await load();
  }

  const open = async (item: Notice) => {
    if (item.readAt === null) await mark(() => markRead(item.id));
    if (item.href) await follow(item.href);
  };

  return (
    <Screen scroll>
      <Text variant="heading">{t.title}</Text>
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={load}>
            {copy.retry}
          </Button>
        </>
      )}
      {markFailed && <Message tone="danger">{t.markError}</Message>}
      <Swap id={data === null ? 'loading' : data.items.length === 0 ? 'empty' : 'list'}>
        {data === null ? (
          <Stack>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : data.items.length === 0 ? (
          <EmptyState title={t.emptyTitle}>{t.emptyHint}</EmptyState>
        ) : (
          <Stack gap="4">
            <Text tone="muted">{data.unread > 0 ? t.unreadCount(data.unread) : t.allRead}</Text>
            {data.unread > 0 && (
              <Button variant="secondary" onPress={() => mark(markAllRead)}>
                {t.markAllRead}
              </Button>
            )}
            {byDay(data.items).map((group) => (
              <Stack key={group.key} gap="1">
                <Text variant="title">{group.label}</Text>
                {group.items.map((item) => (
                  <ListItem
                    key={item.id}
                    title={item.title}
                    description={item.body}
                    trailing={
                      item.readAt === null ? <Badge tone="accent">{t.unreadTag}</Badge> : undefined
                    }
                    onPress={() => open(item)}
                  />
                ))}
              </Stack>
            ))}
          </Stack>
        )}
      </Swap>
    </Screen>
  );
}
