import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { listNotifications, markAllRead, markRead, type Notice } from '../src/notifications/api';
import { Notifications } from '../src/notifications/Notifications';
import { theme } from '../theme/alba';

jest.mock('../src/notifications/api', () => ({
  listNotifications: jest.fn(),
  markRead: jest.fn(async () => ({ readAt: 'x' })),
  markAllRead: jest.fn(async () => ({ marked: 2 })),
}));
const list = listNotifications as jest.MockedFunction<typeof listNotifications>;
const t = copy.notifications;

const notice = (over: Partial<Notice> = {}): Notice => ({
  id: 'n-1',
  type: 'LESSON_FEEDBACK',
  title: 'Tu actividad fue revisada',
  body: 'Mira los comentarios.',
  href: '/aprender/tema/a-1',
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Notifications />
    </ThemeProvider>
  );
}

afterEach(() => jest.clearAllMocks());

describe('Notifications', () => {
  it('groups by day and says what is unread', async () => {
    const old = new Date(Date.now() - 3 * 86_400_000).toISOString();
    list.mockResolvedValue({
      items: [notice(), notice({ id: 'n-2', title: 'Pago recibido', readAt: old, createdAt: old })],
      unread: 1,
    });
    await open();
    expect(await screen.findByText(t.today)).toBeTruthy();
    expect(screen.getByText(t.unreadCount(1))).toBeTruthy();
    expect(screen.getAllByText(t.unreadTag)).toHaveLength(1);
  });

  it('marks it read and opens it in the app', async () => {
    list.mockResolvedValue({ items: [notice()], unread: 1 });
    await open();
    await fireEvent.press(await screen.findByText('Tu actividad fue revisada'));
    expect(markRead).toHaveBeenCalledWith('n-1');
    expect(router.push).toHaveBeenCalledWith('/aprender/tema/a-1');
  });

  it('opens on the web what the app does not have, without marking it again', async () => {
    list.mockResolvedValue({
      items: [notice({ href: '/aprender/examen/x-1', readAt: 'x' })],
      unread: 0,
    });
    await open();
    await fireEvent.press(await screen.findByText('Tu actividad fue revisada'));
    expect(markRead).not.toHaveBeenCalled();
    expect(openBrowserAsync).toHaveBeenCalledWith(
      'https://albafuturoeducativo.com/aprender/examen/x-1'
    );
  });

  it('does not open it when it could not be marked, and says so', async () => {
    (markRead as jest.Mock).mockRejectedValueOnce(new Error('x'));
    list.mockResolvedValue({ items: [notice()], unread: 1 });
    await open();
    await fireEvent.press(await screen.findByText('Tu actividad fue revisada'));
    expect(await screen.findByText(t.markError)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('marks all read', async () => {
    list.mockResolvedValue({ items: [notice()], unread: 1 });
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.markAllRead }));
    expect(markAllRead).toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says when there is nothing', async () => {
    list.mockResolvedValue({ items: [], unread: 0 });
    await open();
    expect(await screen.findByText(t.emptyTitle)).toBeTruthy();
  });
});
