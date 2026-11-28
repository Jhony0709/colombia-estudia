import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { listConversations, pulse, type ConversationRow } from '../src/messages/api';
import { Inbox } from '../src/messages/Inbox';
import { theme } from '../theme/alba';

jest.mock('../src/messages/api', () => ({
  ...jest.requireActual('../src/messages/api'),
  listConversations: jest.fn(),
  pulse: jest.fn(),
}));
const mockSignOut = jest.fn();
jest.mock('../src/SessionProvider', () => ({ useSession: () => ({ signOut: mockSignOut }) }));
const list = listConversations as jest.MockedFunction<typeof listConversations>;

const row = (over: Partial<ConversationRow> = {}): ConversationRow => ({
  id: 'c-1',
  contact: '573001112233',
  contactName: 'Laura',
  personName: null,
  status: 'WAITING',
  assignedToName: null,
  lastMessageAt: new Date().toISOString(),
  lastMessage: { body: '¿Cuánto cuesta?', inbound: true },
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Inbox />
    </ThemeProvider>
  );
}

beforeEach(() => (pulse as jest.Mock).mockResolvedValue('s'));
afterEach(() => jest.clearAllMocks());

describe('Inbox', () => {
  it('lists who waits, each row read whole', async () => {
    list.mockResolvedValue([row()]);
    await open();
    const card = await screen.findByRole('button', {
      name: copy.rowLabel('Laura', copy.status.WAITING, '¿Cuánto cuesta?', 'ahora'),
    });
    expect(card).toBeTruthy();
    expect(list).toHaveBeenCalledWith('waiting');
  });

  it('opens the chat', async () => {
    list.mockResolvedValue([row()]);
    await open();
    await fireEvent.press(await screen.findByText('Laura'));
    expect(router.push).toHaveBeenCalledWith('/mensajes/c-1');
  });

  it('leads to the requests of the students', async () => {
    list.mockResolvedValue([]);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: copy.requests.title }));
    expect(router.push).toHaveBeenCalledWith('/solicitudes');
  });

  it('changes tab, and says which one is selected', async () => {
    list.mockResolvedValue([]);
    await open();
    await screen.findByText(copy.empty.waiting);
    await fireEvent.press(screen.getByRole('tab', { name: copy.views.mine }));
    expect(list).toHaveBeenLastCalledWith('mine');
    expect(await screen.findByText(copy.empty.mine)).toBeTruthy();
    expect(screen.getByRole('tab', { name: copy.views.mine })).toBeSelected();
    expect(screen.getByRole('tab', { name: copy.views.waiting })).not.toBeSelected();
  });

  it('says who attends an open chat', async () => {
    list.mockResolvedValue([row({ status: 'OPEN', assignedToName: 'Marta Gil' })]);
    await open();
    expect(await screen.findByText(copy.attendedBy('Marta Gil'))).toBeTruthy();
  });

  it('offers to retry when it cannot load', async () => {
    list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([row()]);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.retry }));
    expect(await screen.findByText('Laura')).toBeTruthy();
  });

  it('signs out', async () => {
    list.mockResolvedValue([]);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: copy.signOut }));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
