import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  EmptyState,
  ListItem,
  Message,
  Skeleton,
  Stack,
  Swap,
  Tabs,
  Text,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { PushCard } from '../push/PushCard';
import { listConversations, nameOf, type ConversationRow, type View as InboxView } from './api';
import { ago } from './time';
import { usePulse } from './usePulse';

const VIEWS: InboxView[] = ['waiting', 'mine', 'open'];
const TONE = { BOT: 'neutral', WAITING: 'warning', OPEN: 'info', CLOSED: 'neutral' } as const;

function ConversationItem({ row, onOpen }: { row: ConversationRow; onOpen: () => void }) {
  const name = nameOf(row);
  const status =
    row.assignedToName && row.status === 'OPEN'
      ? copy.attendedBy(row.assignedToName)
      : copy.status[row.status];
  const last = row.lastMessage?.body ?? '';
  const when = ago(row.lastMessageAt);
  return (
    <ListItem
      title={name}
      description={last || undefined}
      accessibilityLabel={copy.rowLabel(name, status, last, when)}
      trailing={
        <Stack gap="1" align="flex-end">
          <Text variant="caption" tone="muted">
            {when}
          </Text>
          <Badge tone={TONE[row.status]} look="dot">
            {status}
          </Badge>
        </Stack>
      }
      onPress={onOpen}
    />
  );
}

/** La bandeja (reference/03-ui/movil.md, M1). */
export function Inbox() {
  const router = useRouter();
  const [view, setView] = useState<InboxView>('waiting');
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const shown = useRef(view);
  useEffect(() => {
    shown.current = view;
  }, [view]);

  // Una respuesta de la pestaña anterior que llega tarde no pisa la actual.
  const load = useCallback(
    (which: InboxView = view) =>
      listConversations(which).then(
        (next) => {
          if (shown.current !== which) return;
          setRows(next);
          setFailed(false);
        },
        () => {
          if (shown.current === which) setFailed(true);
        }
      ),
    [view]
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  usePulse(undefined, () => void load());

  return (
    <Screen scroll>
      <Text variant="heading">{copy.inbox}</Text>
      <PushCard />
      <Tabs
        label={copy.inbox}
        items={VIEWS.map((key) => ({ key, label: copy.views[key] }))}
        value={view}
        onChange={(key) => {
          const next = key as InboxView;
          shown.current = next;
          setView(next);
          return load(next);
        }}
      />
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={() => load()}>
            {copy.retry}
          </Button>
        </>
      )}
      <Swap id={rows === null ? 'loading' : `${view}:${rows.length === 0 ? 'empty' : 'rows'}`}>
        {rows === null ? (
          <Stack>
            <Skeleton height={56} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : rows.length === 0 ? (
          <EmptyState title={copy.empty[view]} />
        ) : (
          <View>
            {rows.map((row) => (
              <ConversationItem
                key={row.id}
                row={row}
                onOpen={() => router.push(`/mensajes/${row.id}`)}
              />
            ))}
          </View>
        )}
      </Swap>
    </Screen>
  );
}
