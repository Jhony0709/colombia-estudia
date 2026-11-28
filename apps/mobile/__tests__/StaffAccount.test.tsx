import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { API_URL } from '../src/api';
import { copy } from '../src/copy';
import { StaffAccount } from '../src/account/StaffAccount';
import { theme } from '../theme/alba';

const mockSignOut = jest.fn();
jest.mock('../src/SessionProvider', () => ({
  useSession: () => ({
    state: {
      kind: 'in',
      me: { person: { id: 'p-1', givenName: 'Marta', familyName: 'Gil' }, roles: ['OPERATIONS'] },
    },
    signOut: mockSignOut,
  }),
}));

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <StaffAccount />
    </ThemeProvider>
  );
}

afterEach(() => jest.clearAllMocks());

describe('StaffAccount', () => {
  it('says who is in and signs out', async () => {
    await open();
    expect(screen.getByText('Marta Gil')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: copy.signOut }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('leads to the rest on the web', async () => {
    await open();
    await fireEvent.press(screen.getByRole('link', { name: copy.staffAccount.onWeb }));
    expect(openBrowserAsync).toHaveBeenCalledWith(API_URL);
  });
});
