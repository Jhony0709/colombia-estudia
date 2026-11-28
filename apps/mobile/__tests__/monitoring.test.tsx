import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Sentry from '@sentry/react-native';
import { copy } from '../src/copy';
import { ErrorBoundary } from '../src/ui/ErrorScreen';

const init = Sentry.init as jest.Mock;
const capture = Sentry.captureException as jest.Mock;

type Loaded = typeof import('../src/monitoring') & typeof import('../src/api');

/** `monitoring` lee el DSN al cargarse: cada caso lo carga con el suyo, y con su `ApiError`. */
function load(dsn?: string): Loaded {
  if (dsn) process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
  else delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  let loaded!: Loaded;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = { ...require('../src/monitoring'), ...require('../src/api') };
  });
  return loaded;
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  jest.clearAllMocks();
});

describe('monitoring', () => {
  it('sends nothing without a DSN', () => {
    const { startMonitoring, report } = load();
    startMonitoring();
    report(new Error('x'));
    expect(init).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('starts without personal data', () => {
    load('https://key@example.test/1').startMonitoring();
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@example.test/1', sendDefaultPii: false })
    );
  });

  it('does not report a network or server failure', () => {
    const { startMonitoring, ApiError } = load('https://key@example.test/1');
    startMonitoring();
    const { beforeSend } = init.mock.calls[0][0];
    const event = { message: 'x' };
    expect(
      beforeSend(event, { originalException: new ApiError(409, 'CONFLICT', 'Lo tiene Ana') })
    ).toBeNull();
    expect(beforeSend(event, { originalException: new Error('boom') })).toBe(event);
  });

  it('reports what it is given', () => {
    const error = new Error('boom');
    load('https://key@example.test/1').report(error);
    expect(capture).toHaveBeenCalledWith(error);
  });
});

describe('ErrorBoundary', () => {
  it('says the screen failed, without a theme around it, and tries again', async () => {
    const retry = jest.fn(async () => undefined);
    await render(<ErrorBoundary error={new Error('boom')} retry={retry} />);
    expect(screen.getByText(copy.crashTitle)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: copy.retry }));
    expect(retry).toHaveBeenCalled();
  });
});
