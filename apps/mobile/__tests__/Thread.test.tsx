import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemeProvider } from '@fluxus-ui/native';
import { ApiError } from '../src/api';
import { copy } from '../src/copy';
import {
  closeConversation,
  getConversation,
  pulse,
  replyToConversation,
  takeConversation,
  type Conversation,
} from '../src/messages/api';
import { Thread } from '../src/messages/Thread';
import { theme } from '../theme/alba';

jest.mock('../src/messages/api', () => ({
  ...jest.requireActual('../src/messages/api'),
  getConversation: jest.fn(),
  takeConversation: jest.fn(),
  replyToConversation: jest.fn(),
  closeConversation: jest.fn(),
  pulse: jest.fn(),
  mediaUrl: jest.fn(async () => 'https://storage.test/a.ogg'),
}));
jest.mock('../src/SessionProvider', () => ({
  useSession: () => ({
    state: {
      kind: 'in',
      me: {
        person: { id: 'staff-1', givenName: 'Marta', familyName: 'Gil' },
        roles: ['OPERATIONS'],
      },
    },
  }),
}));
const get = getConversation as jest.MockedFunction<typeof getConversation>;

const chat = (over: Partial<Conversation> = {}): Conversation => ({
  id: 'c-1',
  contact: '573001112233',
  contactName: 'Laura',
  personName: null,
  status: 'WAITING',
  assignedToName: null,
  assignedToId: null,
  canReply: true,
  lastMessageAt: new Date().toISOString(),
  lastMessage: null,
  messages: [
    {
      id: 'm-1',
      inbound: true,
      body: 'Hola',
      authorName: null,
      fromBot: false,
      media: null,
      at: new Date().toISOString(),
    },
    {
      id: 'm-2',
      inbound: true,
      body: '[audio]',
      authorName: null,
      fromBot: false,
      media: { type: 'audio', name: null, url: '/api/conversations/c-1/messages/m-2/media' },
      at: new Date().toISOString(),
    },
  ],
  ...over,
});

const STATUS_BAR = 32;

async function open() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: STATUS_BAR, right: 0, bottom: 24, left: 0 },
      }}
    >
      <ThemeProvider theme={theme} mode="light">
        <Thread id="c-1" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => (pulse as jest.Mock).mockResolvedValue('s'));
afterEach(() => jest.clearAllMocks());

describe('Thread', () => {
  it('shows the messages, and the file instead of its placeholder', async () => {
    get.mockResolvedValue(chat());
    await open();
    expect(await screen.findByText('Hola')).toBeTruthy();
    expect(screen.queryByText('[audio]')).toBeNull();
    expect(await screen.findByRole('button', { name: copy.audio.play })).toBeTruthy();
  });

  it('takes a chat that waits', async () => {
    get
      .mockResolvedValueOnce(chat())
      .mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.take }));
    expect(takeConversation).toHaveBeenCalledWith('c-1');
    expect(await screen.findByLabelText(copy.reply)).toBeTruthy();
  });

  it('says who has it when another took it first', async () => {
    get.mockResolvedValue(chat());
    (takeConversation as jest.Mock).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'Lo atiende Pedro Ruiz')
    );
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.take }));
    expect(await screen.findByText('Lo atiende Pedro Ruiz')).toBeTruthy();
  });

  it('answers in a chat of its own; send stays off until there is a text', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    const sendButton = await screen.findByRole('button', { name: copy.send });
    expect(sendButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(sendButton);
    expect(replyToConversation).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText(copy.reply), '  Cuesta 120.000  ');
    await fireEvent.press(screen.getByRole('button', { name: copy.send }));
    expect(replyToConversation).toHaveBeenCalledWith('c-1', 'Cuesta 120.000');
  });

  it('shows what it sends at once, and clears the field', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    let done: () => void = () => undefined;
    (replyToConversation as jest.Mock).mockReturnValue(new Promise<void>((r) => (done = r)));
    await open();
    await fireEvent.changeText(await screen.findByLabelText(copy.reply), 'Ya te escribo');
    await fireEvent.press(screen.getByRole('button', { name: copy.send }));
    expect(screen.getByText('Ya te escribo')).toBeTruthy();
    expect(screen.getByText(copy.chat.sending)).toBeTruthy();
    expect(screen.getByLabelText(copy.reply).props.value).toBe('');
    await act(async () => done());
    expect(screen.queryByText(copy.chat.sending)).toBeNull();
  });

  it('keeps a message that did not go out, and sends it again', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    (replyToConversation as jest.Mock).mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'));
    await open();
    await fireEvent.changeText(await screen.findByLabelText(copy.reply), 'Hola de nuevo');
    await fireEvent.press(screen.getByRole('button', { name: copy.send }));
    expect(await screen.findByText(copy.chat.failed)).toBeTruthy();
    (replyToConversation as jest.Mock).mockResolvedValue(undefined);
    await fireEvent.press(screen.getByRole('button', { name: copy.retry }));
    expect(replyToConversation).toHaveBeenLastCalledWith('c-1', 'Hola de nuevo');
    expect(screen.queryByText(copy.chat.failed)).toBeNull();
  });

  it('closes a chat of its own from «+», after asking', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.chat.more }));
    await fireEvent.press(await screen.findByRole('button', { name: copy.close }));
    expect(closeConversation).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole('button', { name: copy.chat.confirmClose }));
    expect(closeConversation).toHaveBeenCalledWith('c-1');
  });

  it('sends to the web after 24 h without an answer', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1', canReply: false }));
    await open();
    expect(await screen.findByText(copy.noReply)).toBeTruthy();
    expect(screen.queryByLabelText(copy.reply)).toBeNull();
  });

  it('only reads a chat someone else attends', async () => {
    get.mockResolvedValue(
      chat({ status: 'OPEN', assignedToId: 'staff-2', assignedToName: 'Pedro Ruiz' })
    );
    await open();
    expect(await screen.findByText(copy.attendedBy('Pedro Ruiz'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: copy.take })).toBeNull();
    expect(screen.queryByLabelText(copy.reply)).toBeNull();
  });

  it('lifts the bar above the whole keyboard, counting the status bar above the screen', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    await screen.findByLabelText(copy.reply);
    const area = screen.getByTestId('chat-keyboard');
    // Debajo de la cabecera de 56: su `y` es relativa a la pantalla, no a la ventana.
    await act(async () =>
      fireEvent(area, 'layout', {
        persist: () => undefined,
        nativeEvent: { layout: { x: 0, y: 56, width: 390, height: 732 } },
      })
    );
    await act(async () =>
      // En iOS escucha `keyboardWillShow`; en Android, `keyboardDidShow`.
      DeviceEventEmitter.emit(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', {
        endCoordinates: { screenX: 0, screenY: 520, width: 390, height: 324 },
        duration: 0,
        easing: 'keyboard',
      })
    );
    // Lo que tapa el teclado: 32 + 56 + 732 − 520 = 300.
    const bottom = StyleSheet.flatten(
      screen.getByTestId('chat-keyboard').props.style
    ).paddingBottom;
    expect(bottom).toBe(STATUS_BAR + 56 + 732 - 520);
  });

  it('goes back', async () => {
    get.mockResolvedValue(chat());
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.back }));
    expect(router.back).toHaveBeenCalled();
  });
});
