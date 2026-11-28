import { fireEvent, render, screen } from '@testing-library/react-native';
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

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Thread id="c-1" />
    </ThemeProvider>
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

  it('answers in a chat of its own, and wants a text first', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.send }));
    expect(screen.getByText(copy.replyMissing)).toBeTruthy();
    expect(replyToConversation).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText(copy.reply), '  Cuesta 120.000  ');
    await fireEvent.press(screen.getByRole('button', { name: copy.send }));
    expect(replyToConversation).toHaveBeenCalledWith('c-1', 'Cuesta 120.000');
  });

  it('closes a chat of its own', async () => {
    get.mockResolvedValue(chat({ status: 'OPEN', assignedToId: 'staff-1' }));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.close }));
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

  it('goes back', async () => {
    get.mockResolvedValue(chat());
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.back }));
    expect(router.back).toHaveBeenCalled();
  });
});
