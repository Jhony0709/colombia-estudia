import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from '@fluxus-ui/native';
import { request } from '../src/api';
import { copy } from '../src/copy';
import { markRead } from '../src/notifications/api';
import { enablePush, forgetPush, syncPush } from '../src/push/push';
import { PushCard } from '../src/push/PushCard';
import { PushTaps } from '../src/push/PushTaps';
import { signOut } from '../src/session';
import { theme } from '../theme/alba';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  request: jest.fn(async () => undefined),
  endSession: jest.fn(),
}));
jest.mock('../src/notifications/api', () => ({ markRead: jest.fn(async () => undefined) }));

const call = request as jest.Mock;
const permission = Notifications.getPermissionsAsync as jest.Mock;
const ask = Notifications.requestPermissionsAsync as jest.Mock;
const last = Notifications.useLastNotificationResponse as jest.Mock;
const TOKEN = 'ExponentPushToken[test]';
const registers = { method: 'PUT', body: { token: TOKEN, platform: 'ios' } };
const undecided = { granted: false, canAskAgain: true };

const show = (node: React.ReactNode) =>
  render(
    <ThemeProvider theme={theme} mode="light">
      {node}
    </ThemeProvider>
  );

afterEach(async () => {
  await forgetPush();
  jest.clearAllMocks();
});

describe('push', () => {
  it('registers the phone when it already has permission', async () => {
    expect(await syncPush()).toBe('on');
    expect(call).toHaveBeenCalledWith('/api/push/devices', registers);
    expect(ask).not.toHaveBeenCalled();
  });

  it('does not ask by itself', async () => {
    permission.mockResolvedValueOnce(undecided);
    expect(await syncPush()).toBe('ask');
    expect(ask).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });

  it('leaves it off when the person said no', async () => {
    permission.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    expect(await syncPush()).toBe('off');
    ask.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    expect(await enablePush()).toBe('off');
    expect(call).not.toHaveBeenCalled();
  });

  it('takes the phone off the server before signing out, and off the push service', async () => {
    await syncPush();
    call.mockClear();
    await signOut();
    expect(call.mock.calls.map(([path, options]) => [path, options.method])).toEqual([
      ['/api/push/devices', 'DELETE'],
      ['/api/auth/logout', 'POST'],
    ]);
    expect(call).toHaveBeenCalledWith('/api/push/devices', {
      method: 'DELETE',
      body: { token: TOKEN },
    });
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalled();
  });

  it('stops receiving on the phone even without network', async () => {
    await syncPush();
    call.mockRejectedValue(new Error('network'));
    await expect(signOut()).resolves.toBeUndefined();
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalled();
    call.mockResolvedValue(undefined);
  });
});

describe('PushCard', () => {
  it('asks in context, with a button, and goes away once it is on', async () => {
    permission.mockResolvedValueOnce(undecided);
    await show(<PushCard />);
    await fireEvent.press(await screen.findByRole('button', { name: copy.push.enable }));
    expect(ask).toHaveBeenCalled();
    expect(call).toHaveBeenCalledWith('/api/push/devices', registers);
    expect(screen.queryByText(copy.push.title)).toBeNull();
  });

  it('shows nothing to whoever already decided', async () => {
    await show(<PushCard />);
    expect(screen.queryByText(copy.push.title)).toBeNull();
  });

  it('says so when the phone could not be registered', async () => {
    permission.mockResolvedValueOnce(undecided);
    call.mockRejectedValueOnce(new Error('network'));
    await show(<PushCard />);
    await fireEvent.press(await screen.findByRole('button', { name: copy.push.enable }));
    expect(await screen.findByText(copy.push.failed)).toBeTruthy();
  });
});

describe('PushTaps', () => {
  const tapped = (data: Record<string, unknown>) => ({
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { content: { data } } },
  });

  it('opens what the notice points to and marks it read', async () => {
    last.mockReturnValue(tapped({ href: '/mensajes/c-1', notificationId: 'n-1' }));
    await show(<PushTaps />);
    expect(router.push).toHaveBeenCalledWith('/mensajes/c-1');
    expect(markRead).toHaveBeenCalledWith('n-1');
    expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();
    last.mockReturnValue(null);
  });

  it('does nothing without a tap', async () => {
    await show(<PushTaps />);
    expect(router.push).not.toHaveBeenCalled();
  });
});
