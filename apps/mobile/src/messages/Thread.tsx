import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bubble,
  Button,
  Message,
  Skeleton,
  Stack,
  Text,
  TextArea,
  useTheme,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { ApiError } from '../api';
import { copy } from '../copy';
import { useSession } from '../SessionProvider';
import { WebLink } from '../ui/WebLink';
import {
  closeConversation,
  getConversation,
  nameOf,
  replyToConversation,
  takeConversation,
  type ChatMessage,
  type Conversation,
} from './api';
import { MediaMessage } from './MediaMessage';
import { clock } from './time';
import { usePulse } from './usePulse';

function ChatBubble({ message }: { message: ChatMessage }) {
  const who = message.inbound
    ? null
    : message.fromBot
      ? copy.bot
      : (message.authorName ?? copy.you);
  // El texto `[audio]` es el marcador del archivo: con el archivo a la vista no se repite.
  const body = message.media && /^\[\w+\]$/.test(message.body) ? '' : message.body;
  return (
    <Bubble
      side={message.inbound ? 'start' : 'end'}
      author={who ?? undefined}
      meta={clock(message.at)}
    >
      {message.media && <MediaMessage media={message.media} />}
      {body !== '' && <Text>{body}</Text>}
    </Bubble>
  );
}

/** Un chat (reference/03-ui/movil.md, M1). */
export function Thread({ id }: { id: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { state } = useSession();
  const [chat, setChat] = useState<Conversation | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string>();
  const me = state.kind === 'in' ? state.me.person.id : null;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const seen = useRef(0);

  const load = useCallback(
    () =>
      getConversation(id).then(
        (next) => {
          setChat(next);
          setFailed(false);
        },
        () => setFailed(true)
      ),
    [id]
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  usePulse(id, () => void load());

  // Como scroll-to-latest de la web: al abrir y con cada mensaje nuevo, lo último a la vista.
  useEffect(() => {
    const count = chat?.messages.length ?? 0;
    if (count > seen.current) {
      const animated = seen.current > 0;
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated }));
    }
    seen.current = count;
  }, [chat]);

  /** Lo pulsado espera esta promesa; si falla, el botón lo enseña y el aviso dice por qué. */
  async function act(action: () => Promise<unknown>) {
    setProblem(null);
    try {
      await action();
    } catch (error) {
      // CONFLICT trae el motivo del servidor: quién lo tiene, o que pasaron 24 h.
      setProblem(
        error instanceof ApiError && error.status === 409 ? error.message : copy.actionFailed
      );
      throw error;
    }
    await load();
  }

  function send() {
    const body = draft.trim();
    if (!body) {
      setDraftError(copy.replyMissing);
      return;
    }
    setDraftError(undefined);
    return act(async () => {
      await replyToConversation(id, body);
      setDraft('');
    });
  }

  const mine = chat?.status === 'OPEN' && chat.assignedToId === me;
  const takenByOther = chat?.status === 'OPEN' && !mine;

  return (
    <Screen scroll scrollRef={scroll}>
      <Button variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
        {copy.back}
      </Button>
      <Text variant="heading">{chat ? nameOf(chat) : copy.inbox}</Text>
      {!chat && failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={load}>
            {copy.retry}
          </Button>
        </>
      )}
      {!chat && !failed && (
        <Stack>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </Stack>
      )}
      {chat && (
        <>
          <Text tone="muted">
            {takenByOther && chat.assignedToName
              ? copy.attendedBy(chat.assignedToName)
              : copy.status[chat.status]}
          </Text>
          {chat.messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {problem && <Message tone="danger">{problem}</Message>}
          {!mine && !takenByOther && (
            <Button variant="primary" onPress={() => act(() => takeConversation(id))}>
              {copy.take}
            </Button>
          )}
          {mine && chat.canReply && (
            <View style={{ gap: theme.size['space.3'] }}>
              <TextArea
                label={copy.reply}
                value={draft}
                onChangeText={setDraft}
                error={draftError}
              />
              <Button variant="primary" onPress={send}>
                {copy.send}
              </Button>
            </View>
          )}
          {mine && !chat.canReply && <Message tone="warning">{copy.noReply}</Message>}
          {mine && (
            <Button variant="secondary" onPress={() => act(() => closeConversation(id))}>
              {copy.close}
            </Button>
          )}
          <WebLink path={`/mensajes/${id}`}>{copy.doOnWeb}</WebLink>
        </>
      )}
    </Screen>
  );
}
