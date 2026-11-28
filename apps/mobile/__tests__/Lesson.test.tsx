import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { Lesson } from '../src/learn/Lesson';
import { getLesson, postEvidence, type Lesson as LessonView } from '../src/learn/lessonApi';
import { FLUSH_MS } from '../src/learn/useEvidence';
import { theme } from '../theme/alba';

jest.mock('../src/learn/lessonApi', () => ({
  ...jest.requireActual('../src/learn/lessonApi'),
  getLesson: jest.fn(),
  postEvidence: jest.fn(),
}));
const get = getLesson as jest.MockedFunction<typeof getLesson>;
const post = postEvidence as jest.MockedFunction<typeof postEvidence>;
const t = copy.learn.lesson;

const view = (
  over: Partial<NonNullable<LessonView['lesson']>> = {},
  rest: Partial<LessonView> = {}
): LessonView => ({
  gate: null,
  lesson: {
    assignmentId: 'a-1',
    title: 'Fracciones',
    moduleName: 'Etapa 1',
    estimatedMinutes: 12,
    requiresSubmission: false,
    form: 'MARKDOWN',
    html: '<p>Una fracción…</p>',
    missingAssets: [],
    transcripts: [],
    ...over,
  },
  progress: { status: 'IN_PROGRESS' },
  navigation: {
    previous: null,
    next: {
      assignmentId: 'a-2',
      title: 'Decimales',
      kind: 'LESSON',
      enabled: true,
      blockedBy: null,
      locked: false,
    },
  },
  ...rest,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <Lesson id="a-1" />
    </ThemeProvider>
  );
  await screen.findByText('Fracciones');
}

const message = async (data: object) =>
  act(async () =>
    screen
      .getByTestId('lesson-html')
      .props.onMessage({ nativeEvent: { data: JSON.stringify(data) } })
  );

// El artículo mide 800 y acaba ahí; la pantalla muestra 600 desde `offset`.
async function scrollTo(offset: number) {
  await message({ type: 'height', value: 800 });
  await fireEvent(screen.getByTestId('lesson-article-end'), 'layout', {
    nativeEvent: { layout: { y: 1000 } },
  });
  await fireEvent(screen.getByTestId('lesson-scroll'), 'layout', {
    nativeEvent: { layout: { height: 600 } },
  });
  await fireEvent.scroll(screen.getByTestId('lesson-scroll'), {
    nativeEvent: { contentOffset: { y: offset } },
  });
}

beforeEach(() => {
  // En Jest no hay app: se la da por en primer plano.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  get.mockResolvedValue(view());
  post.mockResolvedValue({ status: 'IN_PROGRESS', justCompleted: false });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('Lesson', () => {
  it('shows the lesson with what the server says of its progress', async () => {
    await open();
    expect(screen.getByText('Etapa 1')).toBeTruthy();
    expect(screen.getByText(t.status.IN_PROGRESS(t.form.MARKDOWN))).toBeTruthy();
    expect(screen.getByText(t.minutes(12))).toBeTruthy();
    const page = screen.getByTestId('lesson-html').props.source;
    expect(page.baseUrl).toBe('https://albafuturoeducativo.com');
    expect(page.html).toContain('<article><p>Una fracción…</p></article>');
  });

  it('sends that the end was seen, and not before', async () => {
    await open();
    await scrollTo(0);
    expect(post).not.toHaveBeenCalled();
    await fireEvent.scroll(screen.getByTestId('lesson-scroll'), {
      nativeEvent: { contentOffset: { y: 400 } },
    });
    expect(post).toHaveBeenCalledWith('a-1', expect.objectContaining({ scrolledToEnd: true }));
  });

  it('sends the seconds every 20 s while on screen', async () => {
    jest.useFakeTimers();
    await open();
    await act(async () => jest.advanceTimersByTime(FLUSH_MS));
    // El envío y el segundo veinte caen en el mismo instante: uno de los dos va primero.
    const [, body] = post.mock.calls[0]!;
    expect(body.secondsOnLesson).toBeGreaterThanOrEqual(19);
    expect(Object.keys(body)).toEqual(['secondsOnLesson']);
  });

  it('sends at once when the video crosses 90 %', async () => {
    get.mockResolvedValue(view({ form: 'VIDEO' }));
    await open();
    await message({ type: 'video', seconds: 50, duration: 100 });
    expect(post).not.toHaveBeenCalled();
    await message({ type: 'video', seconds: 91, duration: 100 });
    expect(post).toHaveBeenCalledWith(
      'a-1',
      expect.objectContaining({ videoPositionSeconds: 91, videoDurationSeconds: 100 })
    );
  });

  it('says it is completed when the server says so', async () => {
    post.mockResolvedValue({ status: 'COMPLETED', justCompleted: true });
    await open();
    await scrollTo(400);
    expect(await screen.findByText(t.completed)).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('counts the transcript read only when open and seen to its end', async () => {
    get.mockResolvedValue(
      view({
        form: 'VIDEO',
        transcripts: [
          { assetId: 'v-1', title: 'Clase 1', cues: [{ start: 0, end: 2, text: 'Hola' }] },
        ],
      })
    );
    await open();
    await fireEvent(screen.getByTestId('lesson-transcript-end'), 'layout', {
      nativeEvent: { layout: { y: 300 } },
    });
    await fireEvent(screen.getByTestId('lesson-scroll'), 'layout', {
      nativeEvent: { layout: { height: 600 } },
    });
    expect(post).not.toHaveBeenCalledWith(
      'a-1',
      expect.objectContaining({ transcriptReadToEnd: true })
    );
    await fireEvent.press(screen.getByText(t.transcriptNamed('Clase 1')));
    expect(post).toHaveBeenCalledWith(
      'a-1',
      expect.objectContaining({ transcriptReadToEnd: true })
    );
  });

  it('goes on to the next lesson, or the exam on the web', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: t.next('Decimales') }));
    expect(router.replace).toHaveBeenCalledWith('/aprender/tema/a-2');
  });

  it('says why the next one waits', async () => {
    get.mockResolvedValue(
      view(
        {},
        {
          navigation: {
            previous: null,
            next: {
              assignmentId: 'a-2',
              title: 'Decimales',
              kind: 'LESSON',
              enabled: false,
              blockedBy: 'Fracciones',
              locked: false,
            },
          },
        }
      )
    );
    await open();
    expect(screen.getByText(t.completeToContinue('Fracciones'))).toBeTruthy();
  });

  it('sends an activity to the web', async () => {
    get.mockResolvedValue(view({ requiresSubmission: true, form: 'SUBMISSION' }));
    await open();
    expect(screen.getByText(t.needsSubmission)).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: copy.learn.onWeb }));
    expect(openBrowserAsync).toHaveBeenCalledWith(
      'https://albafuturoeducativo.com/aprender/tema/a-1'
    );
  });

  it('opens a link of the lesson in the browser of the app', async () => {
    await open();
    const webview = screen.getByTestId('lesson-html');
    expect(
      webview.props.onShouldStartLoadWithRequest({ url: 'about:blank', isTopFrame: true })
    ).toBe(true);
    await act(async () => webview.props.onLoadEnd());
    expect(
      webview.props.onShouldStartLoadWithRequest({
        url: 'https://player.vimeo.com/video/1',
        isTopFrame: false,
      })
    ).toBe(true);
    expect(
      webview.props.onShouldStartLoadWithRequest({
        url: 'https://es.wikipedia.org',
        isTopFrame: true,
      })
    ).toBe(false);
    expect(openBrowserAsync).toHaveBeenCalledWith('https://es.wikipedia.org');
  });

  it.each([
    [{ kind: 'BLOCKED', blockedBy: 'Fracciones' } as const, copy.learn.blockedBy('Fracciones')],
    [{ kind: 'LOCKED' } as const, t.gate.LOCKED.body],
    [{ kind: 'COHORT', cohort: { kind: 'WITHDRAWN' } } as const, copy.learn.gate.WITHDRAWN.title],
  ])('explains the gate %p', async (gate, text) => {
    get.mockResolvedValue({
      ...view(),
      gate,
      lesson: null,
      progress: null,
      navigation: { previous: null, next: null },
    });
    await render(
      <ThemeProvider theme={theme} mode="light">
        <Lesson id="a-1" />
      </ThemeProvider>
    );
    expect(await screen.findByText(text)).toBeTruthy();
  });
});
