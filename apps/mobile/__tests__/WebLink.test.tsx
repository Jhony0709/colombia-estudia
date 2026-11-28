import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider, ToastProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { BrowserNotice, openBrowser } from '../src/ui/browser';
import { WebLink } from '../src/ui/WebLink';
import { theme } from '../theme/alba';

const open = openBrowserAsync as jest.Mock;

const show = () =>
  render(
    <ThemeProvider theme={theme} mode="light">
      <ToastProvider>
        <BrowserNotice />
        <WebLink path="/mensajes">{copy.doOnWeb}</WebLink>
      </ToastProvider>
    </ThemeProvider>
  );
const link = () => screen.getByRole('link', { name: copy.doOnWeb });

afterEach(() => jest.clearAllMocks());

describe('WebLink', () => {
  it('waits while the browser is open and opens it once', async () => {
    let close: () => void = () => undefined;
    open.mockReturnValueOnce(new Promise<void>((resolve) => (close = resolve)));
    await show();
    await fireEvent.press(link());
    await fireEvent.press(link());
    expect(open).toHaveBeenCalledTimes(1);
    expect(link().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await act(async () => close());
    expect(link().props.accessibilityState).toMatchObject({ busy: false, disabled: false });
  });

  it('says so when the browser cannot open', async () => {
    open.mockRejectedValueOnce(new Error('No matching browser activity found'));
    await show();
    await fireEvent.press(link());
    expect(await screen.findByText(copy.webFailed)).toBeTruthy();
    expect(link().props.accessibilityState).toMatchObject({ busy: false });
  });
});

describe('openBrowser', () => {
  it('hands what is not a web address to the system', async () => {
    const system = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openBrowser('mailto:soporte@alba.test');
    expect(system).toHaveBeenCalledWith('mailto:soporte@alba.test');
    expect(open).not.toHaveBeenCalled();
  });
});
