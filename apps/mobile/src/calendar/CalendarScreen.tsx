import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Disclosure,
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
import { openBrowser } from '../ui/browser';
import { agenda, when, type Bucket } from './agenda';
import { getCalendar, type CalendarItem } from './api';

const t = copy.calendar;
const BUCKETS: Bucket[] = ['today', 'week', 'later'];

function Entry({ item, days }: { item: CalendarItem; days: number | null }) {
  const description = [t.kind[item.kind], when(item), days === null ? null : t.distance(days)]
    .filter(Boolean)
    .join(' · ');
  const trailing =
    item.kind === 'LIVE_SESSION' ? (
      item.joinable && item.href ? (
        <Button variant="primary" size="sm" onPress={() => openBrowser(item.href!)}>
          {t.join}
        </Button>
      ) : (
        <Text variant="caption" tone="muted">
          {t.joinLater}
        </Text>
      )
    ) : item.kind === 'ASSESSMENT_DUE' && item.done ? (
      <Badge tone="success">{t.done}</Badge>
    ) : undefined;
  const opensExam = item.kind === 'ASSESSMENT_DUE' && !item.done && item.href;
  return (
    <ListItem
      title={item.title}
      description={description}
      trailing={trailing}
      onPress={opensExam ? () => follow(item.href!) : undefined}
      accessibilityHint={opensExam ? t.openExam : undefined}
    />
  );
}

/** Calendario (reference/03-ui/movil.md, M2). */
export function CalendarScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      getCalendar().then(
        (next) => {
          setItems(next);
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

  const view = items ? agenda(items) : null;
  const upcoming = view ? BUCKETS.flatMap((b) => view.buckets[b]).length : 0;
  const empty =
    view !== null && upcoming === 0 && view.past.length === 0 && view.access.length === 0;

  return (
    <Screen scroll>
      <Button variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
        {copy.learn.lesson.back}
      </Button>
      <Text variant="heading">{t.title}</Text>
      <Text tone="muted">{t.description}</Text>
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={load}>
            {copy.retry}
          </Button>
        </>
      )}
      <Swap id={view === null ? 'loading' : empty ? 'empty' : 'agenda'}>
        {view === null ? (
          <Stack>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : empty ? (
          <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
        ) : (
          <Stack gap="4">
            {view.access.map((item) => (
              <Message key={item.id} tone="info">
                {t.accessUntil(item.programName, when(item), view.daysUntil(item))}
              </Message>
            ))}
            {view.buckets.today.length + view.buckets.week.length === 0 && (
              <Text tone="muted">{t.freeWeek}</Text>
            )}
            {BUCKETS.filter((b) => view.buckets[b].length > 0).map((bucket) => (
              <Stack key={bucket} gap="1">
                <Text variant="title">{t.bucket[bucket]}</Text>
                {view.buckets[bucket].map((item) => (
                  <Entry key={item.id} item={item} days={view.daysUntil(item)} />
                ))}
              </Stack>
            ))}
            {view.past.length > 0 && (
              <Disclosure title={t.past(view.past.length)}>
                <Stack gap="1">
                  {view.past.map((item) => (
                    <Entry key={item.id} item={item} days={null} />
                  ))}
                </Stack>
              </Disclosure>
            )}
          </Stack>
        )}
      </Swap>
    </Screen>
  );
}
