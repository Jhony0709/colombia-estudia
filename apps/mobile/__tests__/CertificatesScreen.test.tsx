import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { request } from '../src/api';
import { copy } from '../src/copy';
import { CertificatesScreen } from '../src/certificates/CertificatesScreen';
import { theme } from '../theme/alba';

jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), request: jest.fn() }));
const call = request as jest.MockedFunction<typeof request>;
const t = copy.certificates;

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <CertificatesScreen />
    </ThemeProvider>
  );
}

afterEach(() => jest.clearAllMocks());

describe('CertificatesScreen', () => {
  it('lists them and opens the public page of one', async () => {
    call.mockResolvedValue([
      {
        id: 'c-1',
        code: 'K7M2Q9',
        kind: 'MODULE',
        moduleName: 'Etapa 1',
        programName: 'Bachillerato',
        issuedAt: '2026-11-01T15:00:00.000Z',
        revokedAt: null,
      },
      {
        id: 'c-2',
        code: 'P4X8T3',
        kind: 'PROGRAM',
        moduleName: null,
        programName: 'Inglés',
        issuedAt: '2026-10-01T15:00:00.000Z',
        revokedAt: '2026-10-05T15:00:00.000Z',
      },
    ]);
    await open();
    expect(call).toHaveBeenCalledWith('/api/learn/certificates');
    await fireEvent.press(await screen.findByText('Etapa 1'));
    expect(openBrowserAsync).toHaveBeenCalledWith(
      'https://albafuturoeducativo.com/certificado/K7M2Q9'
    );
    expect(screen.getByText(t.revoked)).toBeTruthy();
  });

  it('says when there are none', async () => {
    call.mockResolvedValue([]);
    await open();
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it('offers to retry when it cannot load', async () => {
    call.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([]);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.retry }));
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });
});
