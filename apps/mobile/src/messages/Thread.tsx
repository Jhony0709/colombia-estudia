import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheet,
  Bubble,
  Button,
  Message,
  Row,
  Skeleton,
  Stack,
  Swap,
  Text,
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
import { ChatBar, Composer, MoreButton } from './Composer';
import { MediaMessage } from './MediaMessage';
import { clock } from './time';
import { usePulse } from './usePulse';

const t = copy.chat;
/** A menos de esto del final, el chat sigue a lo último que llega. */
const NEAR_END = 48;

/** Lo escrito y sin enviar, por chat, mientras la app está abierta. */
const drafts = new Map<string, string>();

/** Un mensaje que salió del teléfono y aún no está en el chat del servidor. */
interface Pending {
  key: string;
  body: string;
  failed: boolean;
}

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

/** Un chat (reference/03-ui/movil.md, M1): los mensajes arriba y la franja de escribir pegada al teclado. */
export function Thread({ id }: { id: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { state } = useSession();
  const [chat, setChat] = useState<Conversation | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [draft, setDraftState] = useState(() => drafts.get(id) ?? '');
  const [pending, setPending] = useState<Pending[]>([]);
  const [more, setMore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const me = state.kind === 'in' ? state.me.person.id : null;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const atEnd = useRef(true);
  const shown = useRef(false);

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

  // Al abrir el teclado, lo último sigue a la vista, si se estaba viendo.
  useEffect(() => {
    const opened = Keyboard.addListener('keyboardDidShow', () => {
      if (atEnd.current) scroll.current?.scrollToEnd({ animated: true });
    });
    return () => opened.remove();
  }, []);

  function setDraft(text: string) {
    if (text === '') drafts.delete(id);
    else drafts.set(id, text);
    setDraftState(text);
  }

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

  async function deliver(item: Pending) {
    setPending((list) => list.map((p) => (p.key === item.key ? { ...p, failed: false } : p)));
    try {
      await replyToConversation(id, item.body);
    } catch (error) {
      setPending((list) => list.map((p) => (p.key === item.key ? { ...p, failed: true } : p)));
      if (error instanceof ApiError && error.status === 409) setProblem(error.message);
      return;
    }
    await load();
    setPending((list) => list.filter((p) => p.key !== item.key));
  }

  // Como en WhatsApp: el mensaje sale al instante y el campo queda libre; si falla, se reintenta.
  function sendDraft() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setProblem(null);
    atEnd.current = true;
    const item = { key: `local-${Date.now()}`, body, failed: false };
    setPending((list) => [...list, item]);
    void deliver(item);
  }

  const mine = chat?.status === 'OPEN' && chat.assignedToId === me;
  const takenByOther = chat?.status === 'OPEN' && !mine;
  const openMore = () => {
    setConfirming(false);
    setMore(true);
  };

  return (
    <Screen padded={false}>
      <Row
        style={{
          gap: theme.size['space.2'],
          paddingHorizontal: theme.size['space.2'],
          paddingVertical: theme.size['space.1'],
          borderBottomWidth: 1,
          borderBottomColor: theme.color['border.default'],
        }}
      >
        <Button variant="ghost" onPress={() => router.back()}>
          {copy.back}
        </Button>
        <View style={{ flex: 1 }}>
          <Text weight="medium" numberOfLines={1}>
            {chat ? nameOf(chat) : copy.inbox}
          </Text>
          {chat && (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {takenByOther && chat.assignedToName
                ? copy.attendedBy(chat.assignedToName)
                : copy.status[chat.status]}
            </Text>
          )}
        </View>
      </Row>
      {/* `padding` también en Android (borde a borde); el desfase suma el área segura de arriba, que su `y` no cuenta. */}
      <KeyboardAvoidingView
        testID="chat-keyboard"
        behavior="padding"
        keyboardVerticalOffset={top}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: theme.size['layout.gutter'],
            gap: theme.size['space.3'],
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEventThrottle={64}
          onScroll={({ nativeEvent: e }) => {
            atEnd.current =
              e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - NEAR_END;
          }}
          onContentSizeChange={() => {
            if (!atEnd.current) return;
            scroll.current?.scrollToEnd({ animated: shown.current });
            shown.current = true;
          }}
        >
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
          {chat?.messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {pending.map((item) => (
            <View key={item.key} style={{ gap: theme.size['space.1'] }}>
              <Bubble
                side="end"
                author={copy.you}
                meta={item.failed ? t.failed : t.sending}
                status={item.failed ? 'failed' : 'sending'}
              >
                <Text>{item.body}</Text>
              </Bubble>
              {item.failed && (
                <Button
                  variant="ghost"
                  style={{ alignSelf: 'flex-end' }}
                  onPress={() => deliver(item)}
                >
                  {copy.retry}
                </Button>
              )}
            </View>
          ))}
          {problem && <Message tone="danger">{problem}</Message>}
        </ScrollView>
        {chat && mine && chat.canReply && (
          <Composer value={draft} onChange={setDraft} onSend={sendDraft} onMore={openMore} />
        )}
        {chat && mine && !chat.canReply && (
          <ChatBar>
            <MoreButton onPress={openMore} />
            <Message tone="warning" style={{ flex: 1 }}>
              {copy.noReply}
            </Message>
          </ChatBar>
        )}
        {chat && !mine && (
          <ChatBar>
            <MoreButton onPress={openMore} />
            {takenByOther ? (
              <Text tone="muted" style={{ flex: 1, alignSelf: 'center' }}>
                {t.readOnly}
              </Text>
            ) : (
              <Button
                variant="primary"
                style={{ flex: 1 }}
                onPress={() => act(() => takeConversation(id))}
              >
                {copy.take}
              </Button>
            )}
          </ChatBar>
        )}
      </KeyboardAvoidingView>
      <BottomSheet open={more} onClose={() => setMore(false)} title={t.more}>
        <Stack gap="3">
          {mine && (
            <Swap id={confirming ? 'confirm' : 'ask'}>
              {confirming ? (
                <Stack gap="2">
                  <Text>{t.closeQuestion}</Text>
                  <Row wrap>
                    <Button
                      variant="danger"
                      onPress={async () => {
                        await act(() => closeConversation(id));
                        setMore(false);
                      }}
                    >
                      {t.confirmClose}
                    </Button>
                    <Button variant="ghost" onPress={() => setConfirming(false)}>
                      {copy.requests.actions.cancel}
                    </Button>
                  </Row>
                </Stack>
              ) : (
                <Button variant="secondary" onPress={() => setConfirming(true)}>
                  {copy.close}
                </Button>
              )}
            </Swap>
          )}
          <WebLink path={`/mensajes/${id}`}>{copy.doOnWeb}</WebLink>
        </Stack>
      </BottomSheet>
    </Screen>
  );
}
