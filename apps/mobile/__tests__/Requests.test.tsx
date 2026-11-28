import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { ApiError, API_URL } from '../src/api';
import { copy } from '../src/copy';
import {
  dismissRequest,
  grantAttempt,
  listRequests,
  unlockModule,
  type RequestRow,
} from '../src/requests/api';
import { Requests } from '../src/requests/Requests';
import { theme } from '../theme/alba';

jest.mock('../src/requests/api', () => ({
  listRequests: jest.fn(),
  unlockModule: jest.fn(async () => undefined),
  grantAttempt: jest.fn(async () => undefined),
  dismissRequest: jest.fn(async () => undefined),
}));
const list = listRequests as jest.MockedFunction<typeof listRequests>;
const t = copy.requests;

const row = (over: Partial<RequestRow> = {}): RequestRow => ({
  id: 'r-1',
  kind: 'UNLOCK',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  resolvedAt: null,
  resolvedByName: null,
  person: { name: 'Ana Ruiz', isMinor: false, hasGuardian: false },
  cohort: { id: 'c-1', code: 'BACH-1', programName: 'Bachillerato', open: true },
  module: { id: 'm-2', name: 'Ciclo 4' },
  enrollmentId: 'e-1',
  assessment: null,
  whatsappAt: null,
  billing: { overdue: 0 },
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Requests />
    </ThemeProvider>
  );
}

afterEach(() => jest.clearAllMocks());

describe('Requests', () => {
  it('shows who asks, what, and what the server says about their account', async () => {
    list.mockResolvedValue([row(), row({ id: 'r-2', billing: { overdue: 2 } })]);
    await open();
    expect(await screen.findAllByText('Ana Ruiz')).toHaveLength(2);
    expect(screen.getAllByText(t.kind.UNLOCK('Ciclo 4'))).toHaveLength(2);
    expect(screen.getAllByText(t.kind.UNLOCKContext('Bachillerato', 'BACH-1'))).toHaveLength(2);
    expect(screen.getByText(t.context.upToDate)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: t.context.overdue(2) }));
    expect(openBrowserAsync).toHaveBeenCalledWith(`${API_URL}/cartera/e-1`);
    expect(list).toHaveBeenCalledWith('pending');
  });

  it('unlocks the component, says so and asks again', async () => {
    list.mockResolvedValueOnce([row()]).mockResolvedValue([]);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.unlock }));
    expect(await screen.findByText(t.actions.unlocked('Ciclo 4'))).toBeTruthy();
    expect(unlockModule).toHaveBeenCalledWith('e-1', 'm-2');
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it('gives another attempt in the exam', async () => {
    list.mockResolvedValue([
      row({
        kind: 'ATTEMPT',
        assessment: { title: 'Examen final' },
        whatsappAt: '2026-11-27T10:00:00.000Z',
      }),
    ]);
    await open();
    expect(await screen.findByText(t.kind.ATTEMPT('Examen final'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.actions.grant }));
    expect(await screen.findByText(t.actions.granted('Examen final'))).toBeTruthy();
    expect(grantAttempt).toHaveBeenCalledWith('r-1');
  });

  it('dismisses only after a second press', async () => {
    list.mockResolvedValue([row()]);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.dismiss }));
    expect(dismissRequest).not.toHaveBeenCalled();
    // Los botones se relevan con `Swap`: llegan un instante después.
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.cancel }));
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.dismiss }));
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.confirmDismiss }));
    expect(await screen.findByText(t.actions.dismissed)).toBeTruthy();
    expect(dismissRequest).toHaveBeenCalledWith('r-1');
  });

  it('sends enrolling to the web, and warns of a minor without a guardian', async () => {
    list.mockResolvedValue([
      row({
        kind: 'ENROLL',
        enrollmentId: null,
        billing: null,
        person: { name: 'Leo', isMinor: true, hasGuardian: false },
      }),
    ]);
    await open();
    expect(await screen.findByText(t.context.minorNoGuardian)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.actions.unlock })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: t.actions.enrollOnWeb }));
    expect(openBrowserAsync).toHaveBeenCalledWith(`${API_URL}/solicitudes`);
  });

  it('says why when someone else closed it first', async () => {
    list.mockResolvedValue([row()]);
    (unlockModule as jest.Mock).mockRejectedValueOnce(
      new ApiError(409, 'CONFLICT', 'La solicitud ya está cerrada')
    );
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.actions.unlock }));
    expect(await screen.findByText('La solicitud ya está cerrada')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('shows how the closed ones ended', async () => {
    list.mockResolvedValue([]);
    await open();
    await screen.findByText(t.empty);
    list.mockResolvedValue([
      row({ status: 'DISMISSED', resolvedByName: 'Marta', resolvedAt: new Date().toISOString() }),
    ]);
    await fireEvent.press(screen.getByRole('tab', { name: t.views.closed }));
    expect(await screen.findByText(`${t.status.DISMISSED('Marta')} · ahora`)).toBeTruthy();
    expect(list).toHaveBeenLastCalledWith('closed');
    expect(screen.queryByRole('button', { name: t.actions.dismiss })).toBeNull();
  });

  it('offers to retry when the list does not load', async () => {
    list.mockRejectedValueOnce(new Error('network')).mockResolvedValue([]);
    await open();
    expect(await screen.findByText(copy.loadFailed)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: copy.retry }));
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });
});
