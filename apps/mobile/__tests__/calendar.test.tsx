import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { agenda } from '../src/calendar/agenda';
import { getCalendar, type CalendarItem } from '../src/calendar/api';
import { CalendarScreen } from '../src/calendar/CalendarScreen';
import { theme } from '../theme/alba';

jest.mock('../src/calendar/api', () => ({ getCalendar: jest.fn() }));
const calendar = getCalendar as jest.MockedFunction<typeof getCalendar>;
const t = copy.calendar;

const HOUR = 3_600_000;
const item = (over: Partial<CalendarItem>): CalendarItem => ({
  kind: 'LIVE_SESSION',
  id: 'x',
  title: 'Sesión',
  at: new Date(Date.now() + HOUR).toISOString(),
  endsAt: null,
  href: null,
  joinable: false,
  description: null,
  programName: 'Bachillerato',
  done: false,
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <CalendarScreen />
    </ThemeProvider>
  );
  await screen.findByText(t.description);
}

afterEach(() => jest.clearAllMocks());

describe('agenda', () => {
  // 27/11/2026 a las 10:00 en Bogotá (15:00 UTC).
  const now = Date.UTC(2026, 10, 27, 15);
  it('cuts by day in Bogotá, and keeps the end of access apart', () => {
    const { buckets, past, access } = agenda(
      [
        item({ id: 'today', at: '2026-11-28T03:00:00.000Z' }), // 22:00 del 27 en Bogotá
        item({ id: 'week', at: '2026-12-02T15:00:00.000Z' }),
        item({ id: 'later', at: '2026-12-20T15:00:00.000Z' }),
        item({ id: 'gone', at: '2026-11-20T15:00:00.000Z' }),
        item({ id: 'end', kind: 'ACCESS_UNTIL', at: '2026-12-31T00:00:00.000Z' }),
      ],
      now
    );
    expect(buckets.today.map((i) => i.id)).toEqual(['today']);
    expect(buckets.week.map((i) => i.id)).toEqual(['week']);
    expect(buckets.later.map((i) => i.id)).toEqual(['later']);
    expect(past.map((i) => i.id)).toEqual(['gone']);
    expect(access.map((i) => i.id)).toEqual(['end']);
  });
});

describe('CalendarScreen', () => {
  it('joins a live session only when the server says so', async () => {
    calendar.mockResolvedValue([
      item({ id: 'a', title: 'Clase de hoy', joinable: true, href: 'https://meet.example/abc' }),
      item({
        id: 'b',
        title: 'Clase del lunes',
        at: new Date(Date.now() + 72 * HOUR).toISOString(),
      }),
    ]);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.join }));
    expect(openBrowserAsync).toHaveBeenCalledWith('https://meet.example/abc');
    expect(screen.getByText(t.joinLater)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: t.join })).toHaveLength(1);
  });

  it('opens a quiz on the web, and says when it is done', async () => {
    calendar.mockResolvedValue([
      item({
        id: 'q',
        kind: 'ASSESSMENT_DUE',
        title: 'Cuestionario 1',
        href: '/aprender/examen/x-1',
      }),
      item({ id: 'd', kind: 'ASSESSMENT_DUE', title: 'Cuestionario 0', done: true }),
    ]);
    await open();
    await fireEvent.press(await screen.findByText('Cuestionario 1'));
    expect(openBrowserAsync).toHaveBeenCalledWith(
      'https://albafuturoeducativo.com/aprender/examen/x-1'
    );
    expect(screen.getByText(t.done)).toBeTruthy();
  });

  it('says when access ends, once and on top', async () => {
    calendar.mockResolvedValue([
      item({
        id: 'end',
        kind: 'ACCESS_UNTIL',
        at: new Date(Date.now() + 10 * 24 * HOUR).toISOString(),
      }),
    ]);
    await open();
    expect(await screen.findByText(/Tu acceso a Bachillerato termina el/)).toBeTruthy();
    expect(screen.getByText(t.freeWeek)).toBeTruthy();
  });

  it('says when there is nothing', async () => {
    calendar.mockResolvedValue([]);
    await open();
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });
});
