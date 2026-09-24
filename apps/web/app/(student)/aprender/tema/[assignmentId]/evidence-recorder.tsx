'use client';

/**
 * Cuenta y mide; no decide. Manda la evidencia a `POST …/evidence` y el servidor dice si el
 * tema quedó completado (plan/08 §2 «Evidencia»).
 *
 * Qué mide:
 * - segundos con la pestaña visible (el reloj se para al cambiar de pestaña);
 * - si el final del contenido entró en pantalla (un centinela al final del artículo);
 * - en temas con video, la posición y la duración que reporta el player de Vimeo por
 *   `postMessage` (sin SDK: el iframe ya está en el HTML saneado y responde al protocolo
 *   estándar del player).
 *
 * Cuándo manda: cada 20 s si hay algo nuevo, al instante cuando una bandera se enciende o el
 * video cruza el 90 %, y con `keepalive` al ocultarse la pestaña. Al completarse, anuncia y
 * refresca la ruta para que «Siguiente» se habilite sin recargar a mano.
 *
 * Se monta después del artículo y renderiza el centinela y la línea de estado. Sin
 * JavaScript no hay evidencia, y el tema se lee igual: la evidencia es del sistema, no del
 * estudiante.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAnnounce } from '@/lib/a11y/announce';

type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface Snapshot {
  secondsOnLesson: number;
  scrolledToEnd: boolean;
  videoPositionSeconds: number;
  videoDurationSeconds: number;
  transcriptReadToEnd: boolean;
}

/** Lo dispara `transcript-panel.tsx` al llegar al final de la transcripción. */
const TRANSCRIPT_READ_EVENT = 'ce:transcript-read';

const FLUSH_MS = 20_000;
const VIMEO_ORIGIN = 'https://player.vimeo.com';

export function EvidenceRecorder({
  assignmentId,
  form,
  initialStatus,
}: {
  assignmentId: string;
  form: 'VIDEO' | 'MARKDOWN' | 'SUBMISSION';
  initialStatus: Status;
}) {
  const t = useTranslations('learn.evidence');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [status, setStatus] = useState<Status>(initialStatus);
  const sentinel = useRef<HTMLDivElement>(null);

  const snap = useRef<Snapshot>({
    secondsOnLesson: 0,
    scrolledToEnd: false,
    videoPositionSeconds: 0,
    videoDurationSeconds: 0,
    transcriptReadToEnd: false,
  });
  const sent = useRef<Snapshot>({ ...snap.current });
  const done = useRef(initialStatus === 'COMPLETED');
  const inflight = useRef(false);

  useEffect(() => {
    if (done.current) return;

    const flush = async (keepalive = false) => {
      const s = snap.current;
      const last = sent.current;
      const changed =
        s.secondsOnLesson - last.secondsOnLesson >= 5 ||
        s.scrolledToEnd !== last.scrolledToEnd ||
        s.transcriptReadToEnd !== last.transcriptReadToEnd ||
        s.videoPositionSeconds - last.videoPositionSeconds >= 5;
      if (!changed || inflight.current || done.current) return;

      inflight.current = true;
      const body: Record<string, unknown> = { secondsOnLesson: s.secondsOnLesson };
      if (s.scrolledToEnd) body.scrolledToEnd = true;
      if (s.transcriptReadToEnd) body.transcriptReadToEnd = true;
      if (s.videoPositionSeconds > 0) body.videoPositionSeconds = s.videoPositionSeconds;
      if (s.videoDurationSeconds > 0) body.videoDurationSeconds = s.videoDurationSeconds;

      try {
        const res = await fetch(`/api/learn/lessons/${assignmentId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive,
        });
        if (!res.ok) return;
        sent.current = { ...s };
        const payload = (await res.json().catch(() => null)) as {
          data?: { status: Status; justCompleted: boolean };
        } | null;
        const data = payload?.data;
        if (!data) return;
        setStatus(data.status);
        if (data.justCompleted) {
          done.current = true;
          announce(t('completedAnnounce'));
          router.refresh();
        }
      } catch {
        // Sin red no pasa nada: la evidencia se acumula y se manda en el siguiente intento.
      } finally {
        inflight.current = false;
      }
    };

    // Reloj de segundos visibles.
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') snap.current.secondsOnLesson += 1;
    }, 1000);

    // Envío periódico.
    const timer = window.setInterval(() => void flush(), FLUSH_MS);

    // Al volver la conexión se manda lo acumulado sin esperar al reloj (23/9): la evidencia
    // nunca se perdió —`sent` solo avanza cuando el servidor contesta—, pero esperar 20 s
    // con el banner recién apagado hace creer que se perdió.
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);

    // Centinela: el final del artículo entró en pantalla.
    let io: IntersectionObserver | null = null;
    if (sentinel.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && !snap.current.scrolledToEnd) {
            snap.current.scrolledToEnd = true;
            void flush();
          }
        },
        { rootMargin: '0px 0px 40px 0px' }
      );
      io.observe(sentinel.current);
    }

    // Video de Vimeo: posición y duración por postMessage.
    //
    // 23/9, visto con la sesión de Estudiante Uno: el player responde al protocolo antiguo
    // de `postMessage` (sin SDK), y ahí el evento de avance se llama `playProgress`
    // (`{ seconds, percent, duration }`), no `timeupdate`; y `getDuration` contesta en
    // `value`, no en `data`. Esto solo escuchaba `timeupdate`, así que un video **nunca**
    // completaba el tema por verlo: solo la transcripción leída lo completaba. Se aceptan
    // los dos nombres y las dos formas de respuesta.
    const iframes =
      form === 'VIDEO'
        ? Array.from(document.querySelectorAll<HTMLIFrameElement>('article .media-video iframe'))
        : [];
    const subscribe = (f: HTMLIFrameElement) => {
      for (const value of ['playProgress', 'timeupdate']) {
        f.contentWindow?.postMessage(
          JSON.stringify({ method: 'addEventListener', value }),
          VIMEO_ORIGIN
        );
      }
      f.contentWindow?.postMessage(JSON.stringify({ method: 'getDuration' }), VIMEO_ORIGIN);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== VIMEO_ORIGIN) return;
      let msg: {
        event?: string;
        method?: string;
        value?: unknown;
        data?: { seconds?: number; duration?: number };
      } | null = null;
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!msg) return;
      if (msg.event === 'ready') {
        for (const f of iframes) subscribe(f);
        return;
      }
      if (msg.method === 'getDuration') {
        const duration = typeof msg.value === 'number' ? msg.value : msg.data;
        if (typeof duration === 'number') {
          snap.current.videoDurationSeconds = Math.max(snap.current.videoDurationSeconds, duration);
        }
        return;
      }
      if ((msg.event === 'timeupdate' || msg.event === 'playProgress') && msg.data) {
        const seconds = Math.floor(msg.data.seconds ?? 0);
        const duration = Math.floor(msg.data.duration ?? 0);
        const before = snap.current.videoPositionSeconds;
        snap.current.videoPositionSeconds = Math.max(before, seconds);
        if (duration > 0) snap.current.videoDurationSeconds = duration;
        // Cruzar el 90 % es el momento que completa: se manda ya, no en 20 s.
        if (duration > 0 && before < duration * 0.9 && seconds >= duration * 0.9) void flush();
      }
    };
    if (iframes.length > 0) {
      window.addEventListener('message', onMessage);
      // Por si el player ya estaba listo antes de que este efecto se montara.
      for (const f of iframes) subscribe(f);
    }

    // La transcripción leída hasta el final (transcript-panel.tsx) también completa un video.
    const onTranscriptRead = () => {
      if (snap.current.transcriptReadToEnd) return;
      snap.current.transcriptReadToEnd = true;
      void flush();
    };
    window.addEventListener(TRANSCRIPT_READ_EVENT, onTranscriptRead);

    // Al ocultarse la pestaña, un último envío que sobrevive a la navegación.
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush(true);
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => void flush(true));

    return () => {
      window.clearInterval(tick);
      window.clearInterval(timer);
      io?.disconnect();
      window.removeEventListener('message', onMessage);
      window.removeEventListener('online', onOnline);
      window.removeEventListener(TRANSCRIPT_READ_EVENT, onTranscriptRead);
      document.removeEventListener('visibilitychange', onHide);
      void flush(true);
    };
    // `assignmentId` y `form` no cambian sin desmontar la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, form]);

  // El estado visible vive en la barra fija del pie (23/9, `page.tsx`), que el servidor
  // vuelve a pintar tras `router.refresh()`. Aquí queda solo el anuncio para el lector de
  // pantalla, que es lo que cambia en vivo sin recargar.
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <p role="status" className="sr-only">
        {t(`status.${status}`, { form: t(`form.${form}`) })}
      </p>
    </>
  );
}
