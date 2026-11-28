import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { postEvidence, type Evidence, type Status } from './lessonApi';

// Como apps/web/app/(student)/aprender/tema/[assignmentId]/evidence-recorder.tsx.
export const FLUSH_MS = 20_000;

interface Snapshot {
  secondsOnLesson: number;
  scrolledToEnd: boolean;
  videoPositionSeconds: number;
  videoDurationSeconds: number;
  transcriptReadToEnd: boolean;
}

const EMPTY: Snapshot = {
  secondsOnLesson: 0,
  scrolledToEnd: false,
  videoPositionSeconds: 0,
  videoDurationSeconds: 0,
  transcriptReadToEnd: false,
};

/** Mide y manda; el servidor dice si el tema quedó completado. */
export function useEvidence(
  assignmentId: string,
  completed: boolean,
  onResult: (status: Status, justCompleted: boolean) => void
) {
  const snap = useRef({ ...EMPTY });
  const sent = useRef({ ...EMPTY });
  const done = useRef(completed);
  const inflight = useRef(false);
  const result = useRef(onResult);
  useEffect(() => {
    result.current = onResult;
    done.current = done.current || completed;
  });

  const flush = useCallback(
    async (force = false) => {
      const s = snap.current;
      const last = sent.current;
      const changed =
        s.secondsOnLesson - last.secondsOnLesson >= 5 ||
        s.scrolledToEnd !== last.scrolledToEnd ||
        s.transcriptReadToEnd !== last.transcriptReadToEnd ||
        s.videoPositionSeconds - last.videoPositionSeconds >= 5;
      if ((!changed && !force) || inflight.current || done.current) return;
      inflight.current = true;
      const body: Evidence = { secondsOnLesson: s.secondsOnLesson };
      if (s.scrolledToEnd) body.scrolledToEnd = true;
      if (s.transcriptReadToEnd) body.transcriptReadToEnd = true;
      if (s.videoPositionSeconds > 0) body.videoPositionSeconds = s.videoPositionSeconds;
      if (s.videoDurationSeconds > 0) body.videoDurationSeconds = s.videoDurationSeconds;
      try {
        const answer = await postEvidence(assignmentId, body);
        sent.current = { ...s };
        if (answer.justCompleted) done.current = true;
        result.current(answer.status, answer.justCompleted);
      } catch {
        // Sin red no pasa nada: `sent` no avanza y se manda en el siguiente envío.
      } finally {
        inflight.current = false;
      }
    },
    [assignmentId]
  );

  // El reloj corre con la pantalla a la vista y la app en primer plano.
  useFocusEffect(
    useCallback(() => {
      const tick = setInterval(() => {
        if (AppState.currentState === 'active') snap.current.secondsOnLesson += 1;
      }, 1_000);
      const timer = setInterval(() => void flush(), FLUSH_MS);
      const subscription = AppState.addEventListener('change', (now) => {
        if (now !== 'active') void flush();
      });
      return () => {
        clearInterval(tick);
        clearInterval(timer);
        subscription.remove();
        void flush();
      };
    }, [flush])
  );

  return {
    scrolledToEnd() {
      if (snap.current.scrolledToEnd) return;
      snap.current.scrolledToEnd = true;
      void flush();
    },
    transcriptRead() {
      if (snap.current.transcriptReadToEnd) return;
      snap.current.transcriptReadToEnd = true;
      void flush();
    },
    video(seconds: number, duration: number) {
      const before = snap.current.videoPositionSeconds;
      const at = Math.floor(seconds);
      const total = Math.floor(duration);
      snap.current.videoPositionSeconds = Math.max(before, at);
      if (total > 0) snap.current.videoDurationSeconds = total;
      // Cruzar el 90 % es lo que completa: se manda ya, no en 20 s.
      if (total > 0 && before < total * 0.9 && at >= total * 0.9) void flush();
    },
  };
}
