import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, Text } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { ApiError } from '../src/api';
import { AccessScreen } from '../src/AccessScreen';
import { copy } from '../src/copy';
import { abandon, currentUser, recover, signIn, signOut, verifyCode } from '../src/session';
import { SessionProvider, useSession } from '../src/SessionProvider';
import { Loading } from '../src/ui/Loading';
import { Offline } from '../src/ui/Offline';
import { theme } from '../theme/alba';

jest.mock('../src/session', () => ({
  currentUser: jest.fn(),
  signIn: jest.fn(),
  verifyCode: jest.fn(),
  signOut: jest.fn(),
  abandon: jest.fn(),
  recover: jest.fn(),
}));
const me = currentUser as jest.MockedFunction<typeof currentUser>;
const enter = signIn as jest.MockedFunction<typeof signIn>;
const verify = verifyCode as jest.MockedFunction<typeof verifyCode>;
const leave = signOut as jest.MockedFunction<typeof signOut>;

const ana = { person: { id: 'p1', givenName: 'Ana', familyName: 'Ríos' }, roles: ['STUDENT'] };
const ops = { ...ana, roles: ['OPERATIONS'] };
const pending = {
  tokens: { accessToken: 'at-1', refreshToken: 'rt-1', expiresAt: 1 },
  factorId: 'f-1',
};

// Lo que hace app/_layout.tsx: cargando, acceso, o dentro.
function Gate() {
  const { state } = useSession();
  if (state.kind === 'checking') return <Loading />;
  if (state.kind === 'offline') return <Offline />;
  if (state.kind !== 'in') return <AccessScreen />;
  return <Text>{`dentro:${state.me.person.givenName}`}</Text>;
}

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </ThemeProvider>
  );
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText(copy.email), email);
  await fireEvent.changeText(screen.getByLabelText(copy.password), password);
  await fireEvent.press(screen.getByRole('button', { name: copy.submit }));
}

// El aviso de Message no es un elemento accesible propio: se busca el rol subiendo desde el texto.
type Node = { props: Record<string, unknown>; parent: Node | null };
function roleAround(node: Node | null): unknown {
  for (let at = node; at; at = at.parent) if (at.props.role) return at.props.role;
  return undefined;
}

beforeEach(() => {
  me.mockResolvedValue(null);
  leave.mockResolvedValue(undefined);
});
afterEach(() => jest.resetAllMocks());

describe('AccessScreen', () => {
  it('says it is loading while it checks the session', async () => {
    me.mockReturnValue(new Promise(() => {}));
    await open();
    expect(screen.getByRole('status', { name: copy.loading })).toBeTruthy();
  });

  it('shows the form without a session, every control with its name', async () => {
    await open();
    expect(await screen.findByRole('heading', { name: copy.title })).toBeTruthy();
    expect(screen.getByLabelText(copy.email)).toBeTruthy();
    expect(screen.getByLabelText(copy.password).props.secureTextEntry).toBe(true);
    expect(screen.getByRole('button', { name: copy.submit })).toBeTruthy();
    expect(screen.getByRole('button', { name: copy.forgot })).toBeTruthy();
  });

  it('shows the password on request', async () => {
    me.mockResolvedValue(null);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.showPassword }));
    expect(screen.getByLabelText(copy.password).props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: copy.hidePassword })).toBeTruthy();
  });

  it('keeps the saved session when it opens without a connection, and tries again', async () => {
    me.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'));
    await open();
    expect(await screen.findByText(copy.offlineTitle)).toBeTruthy();
    expect(screen.queryByLabelText(copy.email)).toBeNull();
    expect(leave).not.toHaveBeenCalled();
    me.mockResolvedValue(ana);
    await fireEvent.press(screen.getByRole('button', { name: copy.retry }));
    expect(await screen.findByText('dentro:Ana')).toBeTruthy();
  });

  it('tries again by itself when the app comes back to the front', async () => {
    let back: (state: 'active') => void = () => undefined;
    const listen = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      back = fn;
      return { remove: jest.fn() } as never;
    });
    me.mockRejectedValueOnce(new ApiError(503, 'INTERNAL', 'x'));
    await open();
    await screen.findByText(copy.offlineTitle);
    me.mockResolvedValue(ana);
    back('active');
    expect(await screen.findByText('dentro:Ana')).toBeTruthy();
    listen.mockRestore();
  });

  it('checks the fields before calling the server', async () => {
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill('ana.x.co', '');
    expect(screen.getByText(copy.emailInvalid)).toBeTruthy();
    expect(screen.getByText(copy.passwordMissing)).toBeTruthy();
    expect(screen.getByLabelText(copy.email).props.accessibilityHint).toBe(copy.emailInvalid);
    expect(enter).not.toHaveBeenCalled();
  });

  it('lets a student in', async () => {
    enter.mockResolvedValue({ kind: 'in', me: ana });
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill(' ana@x.co ', 'secreta');
    expect(enter).toHaveBeenCalledWith('ana@x.co', 'secreta');
    expect(await screen.findByText('dentro:Ana')).toBeTruthy();
  });

  it('opens with the session it already has, for staff too', async () => {
    me.mockResolvedValue(ops);
    await open();
    expect(await screen.findByText('dentro:Ana')).toBeTruthy();
  });

  it.each([
    [
      'wrong password',
      new ApiError(401, 'UNAUTHENTICATED', 'Correo o contraseña incorrectos'),
      'Correo o contraseña incorrectos',
    ],
    ['too many tries', new ApiError(429, 'RATE_LIMITED', 'x'), copy.rateLimited],
    ['no connection', new ApiError(0, 'NETWORK', 'x'), copy.offline],
    ['server down', new ApiError(503, 'INTERNAL', 'x'), copy.offline],
    ['email the server rejects', new ApiError(400, 'VALIDATION_ERROR', 'x'), copy.checkFields],
  ])('says what went wrong: %s', async (_, error, text) => {
    enter.mockRejectedValue(error);
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill('ana@x.co', 'secreta');
    expect(roleAround(await screen.findByText(text))).toBe('alert');
  });

  it('sends staff without a second factor to the web', async () => {
    enter.mockRejectedValue(
      new ApiError(403, 'INSUFFICIENT_CAPABILITY', 'Activa el segundo factor en la web.')
    );
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill('admin@x.co', 'secreta');
    expect(await screen.findByText('Activa el segundo factor en la web.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: copy.openWeb }));
    expect(openBrowserAsync).toHaveBeenCalledWith('https://albafuturoeducativo.com');
  });

  it('turns away a role the app has nothing for', async () => {
    enter.mockResolvedValue({ kind: 'other' });
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill('profe@x.co', 'secreta');
    expect(await screen.findByText(copy.other)).toBeTruthy();
  });

  it('closes a session found on opening when the role has nothing here', async () => {
    me.mockResolvedValue({ ...ana, roles: ['INSTRUCTOR'] });
    await open();
    expect(await screen.findByText(copy.other)).toBeTruthy();
    expect(leave).toHaveBeenCalled();
  });

  describe('the second factor', () => {
    async function toCode() {
      enter.mockResolvedValue({ kind: 'mfa', pending });
      await open();
      await screen.findByRole('heading', { name: copy.title });
      await fill('ops@x.co', 'secreta');
      await screen.findByRole('heading', { name: copy.mfaTitle });
    }

    it('asks for the code, a field for one-time codes', async () => {
      await toCode();
      const field = screen.getByLabelText(copy.mfaCode);
      expect(field.props.textContentType).toBe('oneTimeCode');
      expect(field.props.keyboardType).toBe('number-pad');
    });

    it('wants 6 digits before calling the server', async () => {
      await toCode();
      await fireEvent.changeText(screen.getByLabelText(copy.mfaCode), '12a');
      await fireEvent.press(screen.getByRole('button', { name: copy.mfaSubmit }));
      expect(screen.getByText(copy.mfaMissing)).toBeTruthy();
      expect(verify).not.toHaveBeenCalled();
    });

    it('lets staff in with the code', async () => {
      await toCode();
      verify.mockResolvedValue({ kind: 'in', me: ops });
      await fireEvent.changeText(screen.getByLabelText(copy.mfaCode), '123456');
      await fireEvent.press(screen.getByRole('button', { name: copy.mfaSubmit }));
      expect(verify).toHaveBeenCalledWith(pending, '123456');
      expect(await screen.findByText('dentro:Ana')).toBeTruthy();
    });

    it('stays on the code when it is wrong', async () => {
      await toCode();
      verify.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Código inválido'));
      await fireEvent.changeText(screen.getByLabelText(copy.mfaCode), '000000');
      await fireEvent.press(screen.getByRole('button', { name: copy.mfaSubmit }));
      expect(roleAround(await screen.findByText(copy.mfaWrong))).toBe('alert');
      expect(screen.getByRole('heading', { name: copy.mfaTitle })).toBeTruthy();
    });

    it('goes back and does not leave the aal1 session open', async () => {
      await toCode();
      await fireEvent.press(screen.getByRole('button', { name: copy.mfaBack }));
      expect(abandon).toHaveBeenCalledWith(pending);
      expect(await screen.findByRole('heading', { name: copy.title })).toBeTruthy();
    });
  });

  it('reads errors aloud on iOS, where a live region does not exist', async () => {
    const os = Platform.OS;
    Platform.OS = 'ios';
    const speak = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    enter.mockRejectedValue(new ApiError(0, 'NETWORK', 'x'));
    await open();
    await screen.findByRole('heading', { name: copy.title });
    await fill('', 'x');
    expect(speak).toHaveBeenLastCalledWith(copy.emailMissing);
    await fill('ana@x.co', 'secreta');
    await screen.findByText(copy.offline);
    expect(speak).toHaveBeenLastCalledWith(`${copy.errorTitle}. ${copy.offline}`);
    Platform.OS = os;
  });

  describe('forgotten password', () => {
    async function toRecover() {
      await open();
      await fireEvent.press(await screen.findByRole('button', { name: copy.forgot }));
      await screen.findByRole('heading', { name: copy.recover });
    }

    it('wants an email before calling the server', async () => {
      await toRecover();
      await fireEvent.press(screen.getByRole('button', { name: copy.recoverSubmit }));
      expect(screen.getByText(copy.emailMissing)).toBeTruthy();
      expect(recover).not.toHaveBeenCalled();
    });

    it('says what the server says, the same whether the email exists or not', async () => {
      (recover as jest.Mock).mockResolvedValue({
        message: 'Si el correo existe, te enviamos un enlace',
      });
      await toRecover();
      await fireEvent.changeText(screen.getByLabelText(copy.email), ' ana@x.co ');
      await fireEvent.press(screen.getByRole('button', { name: copy.recoverSubmit }));
      expect(recover).toHaveBeenCalledWith('ana@x.co');
      expect(await screen.findByText('Si el correo existe, te enviamos un enlace')).toBeTruthy();
    });

    it('says to wait after too many tries', async () => {
      (recover as jest.Mock).mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'x'));
      await toRecover();
      await fireEvent.changeText(screen.getByLabelText(copy.email), 'ana@x.co');
      await fireEvent.press(screen.getByRole('button', { name: copy.recoverSubmit }));
      expect(await screen.findByText(copy.rateLimited)).toBeTruthy();
    });

    it('goes back to signing in', async () => {
      await toRecover();
      await fireEvent.press(screen.getByRole('button', { name: copy.backToLogin }));
      expect(await screen.findByRole('heading', { name: copy.title })).toBeTruthy();
    });
  });
});
