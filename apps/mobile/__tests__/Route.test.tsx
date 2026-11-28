import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import {
  getOutline,
  listEnrollments,
  unreadNotifications,
  type CohortOutline,
  type RouteItem,
} from '../src/learn/api';
import { Route } from '../src/learn/Route';
import { theme } from '../theme/alba';

jest.mock('../src/learn/api', () => ({
  ...jest.requireActual('../src/learn/api'),
  listEnrollments: jest.fn(),
  getOutline: jest.fn(),
  unreadNotifications: jest.fn(),
}));
jest.mock('../src/SessionProvider', () => ({ useSession: () => ({ signOut: jest.fn() }) }));
const mockSetUnread = jest.fn();
jest.mock('../src/notifications/unread', () => ({
  setUnread: (count: number) => mockSetUnread(count),
}));
const outlineOf = getOutline as jest.MockedFunction<typeof getOutline>;
const enrollments = listEnrollments as jest.MockedFunction<typeof listEnrollments>;
const t = copy.learn;

const item = (over: Partial<RouteItem> = {}): RouteItem => ({
  kind: 'LESSON',
  assignmentId: 'a-1',
  title: 'Fracciones',
  status: 'NOT_STARTED',
  form: 'MARKDOWN',
  estimatedMinutes: 12,
  enabled: true,
  blockedBy: null,
  unavailableReason: null,
  ...over,
});

const cohort = {
  id: 'c-1',
  name: 'Cohorte 2026-1',
  programName: 'Bachillerato',
  programFree: false,
};
const outline = (over: Partial<CohortOutline> = {}): CohortOutline => ({
  gate: null,
  enrollmentId: 'e-1',
  cohort,
  modules: [
    {
      id: 'm-1',
      name: 'Etapa 1',
      access: { state: 'OPEN' },
      installment: null,
      items: [
        item(),
        item({ assignmentId: 'a-2', title: 'Decimales', enabled: false, blockedBy: 'Fracciones' }),
        item({
          assignmentId: 'x-1',
          kind: 'ASSESSMENT',
          form: 'ASSESSMENT',
          title: 'Examen 1',
          estimatedMinutes: null,
        }),
      ],
    },
    {
      id: 'm-2',
      name: 'Etapa 2',
      access: { state: 'LOCKED' },
      installment: { position: 2, amount: 120000 },
      items: [],
    },
  ],
  resume: item(),
  progress: { completed: 3, total: 12 },
  partnerFunded: false,
  awaitingPlan: false,
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Route />
    </ThemeProvider>
  );
}

beforeEach(() => {
  enrollments.mockResolvedValue([{ enrollmentId: 'e-1', cohort }]);
  outlineOf.mockResolvedValue(outline());
  (unreadNotifications as jest.Mock).mockResolvedValue(0);
});
afterEach(() => jest.clearAllMocks());

describe('Route', () => {
  it('shows the program, its progress and where to go on', async () => {
    await open();
    expect(await screen.findByText('Bachillerato')).toBeTruthy();
    expect(screen.getByText(t.progress(3, 12))).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: t.progressLabel('Bachillerato') })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.resume('Fracciones') }));
    expect(router.push).toHaveBeenCalledWith('/aprender/tema/a-1');
  });

  it('says why a step waits, with what the server says', async () => {
    await open();
    expect(
      await screen.findByText(`${t.form.MARKDOWN} · ${t.minutes(12)}. ${t.blockedBy('Fracciones')}`)
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Decimales/ })).toBeNull();
  });

  it('sends an exam to the web', async () => {
    await open();
    expect(await screen.findByText(`${t.form.ASSESSMENT}. ${t.onWeb}`)).toBeTruthy();
    await fireEvent.press(screen.getByText('Examen 1'));
    expect(openBrowserAsync).toHaveBeenCalledWith(
      'https://albafuturoeducativo.com/aprender/examen/x-1'
    );
  });

  it('says a stage opens with its installment', async () => {
    await open();
    await fireEvent.press(await screen.findByText(`Etapa 2 · ${t.moduleLocked}`));
    expect(await screen.findByText(t.moduleAccess.INSTALLMENT(2, '$ 120.000'))).toBeTruthy();
  });

  it.each([
    [{ kind: 'NO_ENROLLMENT' } as const, t.gate.NO_ENROLLMENT.title],
    [
      { kind: 'NOT_STARTED_YET', startsOn: '2026-12-01' } as const,
      t.gate.NOT_STARTED_YET.body('1 de diciembre de 2026'),
    ],
    [
      { kind: 'ACCESS_EXPIRED', accessUntil: '2026-11-30' } as const,
      t.gate.ACCESS_EXPIRED.body('30 de noviembre de 2026'),
    ],
    [{ kind: 'WITHDRAWN' } as const, t.gate.WITHDRAWN.title],
  ])('explains the gate %p', async (gate, text) => {
    outlineOf.mockResolvedValue(outline({ gate, cohort: null, modules: [] }));
    await open();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('says when a partner pays, and when the plan is not ready', async () => {
    outlineOf.mockResolvedValue(outline({ partnerFunded: true, awaitingPlan: true }));
    await open();
    expect(await screen.findByText(t.partnerFunded)).toBeTruthy();
    expect(screen.getByText(t.noPlanBody)).toBeTruthy();
  });

  it('lets choose the program when there are several', async () => {
    enrollments.mockResolvedValue([
      { enrollmentId: 'e-1', cohort },
      { enrollmentId: 'e-2', cohort: { ...cohort, id: 'c-2', programName: 'Inglés' } },
    ]);
    await open();
    expect(await screen.findByLabelText(`${t.program}, Bachillerato`)).toBeTruthy();
    expect(getOutline).toHaveBeenCalledWith(null);
  });

  it('offers to retry when it cannot load', async () => {
    outlineOf.mockRejectedValueOnce(new Error('x'));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: copy.retry }));
    expect(await screen.findByText('Bachillerato')).toBeTruthy();
  });

  it('tells the tab how many notices are unread', async () => {
    (unreadNotifications as jest.Mock).mockResolvedValue(4);
    await open();
    await waitFor(() => expect(mockSetUnread).toHaveBeenCalledWith(4));
  });

  it('opens the certificates; the rest is in the tabs', async () => {
    await open();
    await fireEvent.press(await screen.findByText(t.certificates));
    expect(router.push).toHaveBeenCalledWith('/aprender/certificados');
    expect(screen.queryByText(t.notifications)).toBeNull();
    expect(screen.queryByText(t.calendar)).toBeNull();
  });
});
