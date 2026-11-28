import { useCallback, useRef, useState } from 'react';
import { PixelRatio, Platform, View, type LayoutChangeEvent } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Accordion,
  Badge,
  Button,
  EmptyState,
  Message,
  Skeleton,
  Stack,
  Text,
  useTheme,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import type { theme as alba } from '../../theme/alba';
import { API_URL } from '../api';
import { copy } from '../copy';
import { openBrowser } from '../ui/browser';
import { openWeb, WebLink } from '../ui/WebLink';
import { gateText } from './gates';
import { getLesson, type Lesson as LessonView, type Neighbour, type Status } from './lessonApi';
import { lessonDocument } from './lessonDocument';
import { useEvidence } from './useEvidence';

const t = copy.learn.lesson;
/** Como el `rootMargin` del centinela de la web: 40 puntos antes del final ya cuenta. */
const MARGIN = 40;
const TONE = { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success' } as const;

function gateOf(view: LessonView): { title: string; body?: string } | null {
  const gate = view.gate;
  if (!gate) return null;
  switch (gate.kind) {
    case 'COHORT':
      return gateText(gate.cohort);
    case 'NOT_ASSIGNED':
      return { title: t.gate.NOT_ASSIGNED };
    case 'BLOCKED':
      return { title: t.gate.BLOCKED, body: copy.learn.blockedBy(gate.blockedBy) };
    default:
      return t.gate[gate.kind];
  }
}

function Step({
  to,
  label,
  onOpen,
}: {
  to: Neighbour;
  label: string;
  onOpen: (to: Neighbour) => void | Promise<unknown>;
}) {
  if (to.enabled) {
    return (
      <Button variant="secondary" onPress={() => onOpen(to)}>
        {label}
      </Button>
    );
  }
  return (
    <Text tone="muted">
      {to.locked ? t.nextLocked : t.completeToContinue(to.blockedBy ?? to.title)}
    </Text>
  );
}

/** Un tema (reference/03-ui/movil.md, M2, «El tema»). */
export function Lesson({ id }: { id: string }) {
  const theme = useTheme<typeof alba>();
  const router = useRouter();
  const [view, setView] = useState<LessonView | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<Status>('NOT_STARTED');
  const [justCompleted, setJustCompleted] = useState(false);
  const [height, setHeight] = useState(0);
  const openTranscripts = useRef(false);
  // Dónde acaba el artículo y dónde la transcripción, en el contenido del scroll.
  const ends = useRef({ article: Infinity, transcript: Infinity, viewport: 0, offset: 0 });

  const load = useCallback(
    () =>
      getLesson(id).then(
        (next) => {
          setView(next);
          setStatus(next.progress?.status ?? 'NOT_STARTED');
          setFailed(false);
        },
        (error: unknown) => {
          setFailed(true);
          throw error;
        }
      ),
    [id]
  );
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const evidence = useEvidence(id, status === 'COMPLETED', (next, completed) => {
    setStatus(next);
    if (completed) {
      setJustCompleted(true);
      void load().catch(() => undefined);
    }
  });

  const check = () => {
    const { article, transcript, viewport, offset } = ends.current;
    const bottom = offset + viewport + MARGIN;
    if (height > 0 && bottom >= article) evidence.scrolledToEnd();
    if (openTranscripts.current && bottom >= transcript) evidence.transcriptRead();
  };
  const markEnd = (key: 'article' | 'transcript', e: LayoutChangeEvent) => {
    ends.current[key] = e.nativeEvent.layout.y;
    check();
  };

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; value?: number; seconds?: number; duration?: number };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'height' && typeof message.value === 'number') setHeight(message.value);
    if (message.type === 'video') evidence.video(message.seconds ?? 0, message.duration ?? 0);
  };

  const go = (to: Neighbour): void | Promise<unknown> =>
    to.kind === 'LESSON'
      ? router.replace(`/aprender/tema/${to.assignmentId}`)
      : openWeb(`/aprender/examen/${to.assignmentId}`);

  const lesson = view?.lesson;
  const gate = view ? gateOf(view) : null;
  const scale = PixelRatio.getFontScale();
  // En iOS la WebView no sigue la letra del sistema: se escala el CSS; Android usa `textZoom`.
  const page = lesson ? lessonDocument(lesson.html, theme, Platform.OS === 'ios' ? scale : 1) : '';
  const loaded = useRef(false);

  return (
    // Sin relleno: la WebView va de borde a borde y cada bloque pone el suyo.
    <Screen
      scroll
      padded={false}
      scrollProps={{
        testID: 'lesson-scroll',
        scrollEventThrottle: 100,
        onLayout: (e) => {
          ends.current.viewport = e.nativeEvent.layout.height;
          check();
        },
        onScroll: (e) => {
          ends.current.offset = e.nativeEvent.contentOffset.y;
          check();
        },
        contentContainerStyle: {
          paddingVertical: theme.size['layout.gutter'],
          gap: theme.size['space.4'],
        },
      }}
    >
      <Stack gap="2" style={{ paddingHorizontal: theme.size['layout.gutter'] }}>
        <Button variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
          {t.back}
        </Button>
        {lesson && (
          <Text variant="caption" tone="muted">
            {lesson.moduleName}
          </Text>
        )}
        <Text variant="heading">{lesson?.title ?? copy.learn.title}</Text>
        {lesson && (
          <Stack gap="1">
            <Badge tone={TONE[status]} look="dot">
              {copy.learn.status[status]}
            </Badge>
            <Text tone="muted">
              {status === 'IN_PROGRESS'
                ? t.status.IN_PROGRESS(t.form[lesson.form])
                : t.status[status]}
            </Text>
            {lesson.estimatedMinutes ? (
              <Text variant="caption" tone="muted">
                {t.minutes(lesson.estimatedMinutes)}
              </Text>
            ) : null}
          </Stack>
        )}
        {failed && !view && (
          <>
            <Message tone="danger">{copy.loadFailed}</Message>
            <Button variant="secondary" onPress={load}>
              {copy.retry}
            </Button>
          </>
        )}
        {gate && <EmptyState title={gate.title}>{gate.body}</EmptyState>}
        {lesson && lesson.missingAssets.length > 0 && (
          <Message tone="warning">{t.missingAssets(lesson.missingAssets.length)}</Message>
        )}
        {lesson?.requiresSubmission && (
          <>
            <Message tone="info">{t.needsSubmission}</Message>
            <WebLink path={`/aprender/tema/${id}`}>{copy.learn.onWeb}</WebLink>
          </>
        )}
        {justCompleted && <Message tone="success">{t.completed}</Message>}
      </Stack>
      {!view && !failed && (
        <Stack style={{ paddingHorizontal: theme.size['layout.gutter'] }}>
          <Skeleton height={24} />
          <Skeleton height={240} />
        </Stack>
      )}
      {lesson && (
        <View style={{ height: height || 1 }}>
          {height === 0 && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                paddingHorizontal: theme.size['layout.gutter'],
              }}
            >
              <Skeleton height={240} />
            </View>
          )}
          <WebView
            testID="lesson-html"
            source={{ html: page, baseUrl: API_URL }}
            originWhitelist={['*']}
            scrollEnabled={false}
            javaScriptEnabled
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            textZoom={Math.round(scale * 100)}
            style={{ backgroundColor: 'transparent', opacity: height === 0 ? 0 : 1 }}
            onMessage={onMessage}
            onLoadEnd={() => {
              loaded.current = true;
            }}
            onShouldStartLoadWithRequest={(request) => {
              // La página y sus iframes cargan; un enlace del tema, al navegador de la app.
              if (!loaded.current || request.isTopFrame === false) return true;
              void openBrowser(request.url).catch(() => undefined);
              return false;
            }}
          />
        </View>
      )}
      <View testID="lesson-article-end" onLayout={(e) => markEnd('article', e)} />
      {lesson && lesson.transcripts.length > 0 && (
        <View style={{ paddingHorizontal: theme.size['layout.gutter'] }}>
          <Accordion
            multiple
            onChange={(open) => {
              openTranscripts.current = open.length > 0;
              check();
            }}
            items={lesson.transcripts.map((transcript) => ({
              key: transcript.assetId,
              title: transcript.title ? t.transcriptNamed(transcript.title) : t.transcript,
              content: (
                <Stack gap="2">
                  {transcript.cues.map((cue) => (
                    <Text key={`${cue.start}-${cue.end}`}>{cue.text}</Text>
                  ))}
                </Stack>
              ),
            }))}
          />
        </View>
      )}
      <View testID="lesson-transcript-end" onLayout={(e) => markEnd('transcript', e)} />
      {view && (view.navigation.previous || view.navigation.next) && (
        <Stack style={{ paddingHorizontal: theme.size['layout.gutter'] }}>
          {view.navigation.next && (
            <Step
              to={view.navigation.next}
              label={
                view.navigation.next.kind === 'ASSESSMENT'
                  ? t.nextExam(view.navigation.next.title)
                  : t.next(view.navigation.next.title)
              }
              onOpen={go}
            />
          )}
          {view.navigation.previous?.enabled && (
            <Button variant="ghost" onPress={() => go(view.navigation.previous!)}>
              {t.previous(view.navigation.previous.title)}
            </Button>
          )}
        </Stack>
      )}
    </Screen>
  );
}
