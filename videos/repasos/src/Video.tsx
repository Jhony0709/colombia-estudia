import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { useEffect, useState } from 'react';
import { Captions, type Chunk, type Escena, type Tema } from './components';
import { SCENES } from './scenes';
import { C } from './theme';
import { TIMINGS } from './timings';

export interface TimedEscena extends Escena {
  audio: string;
  chunks: Chunk[];
  frames: number;
  voiceFrames: number;
  lead: number;
  words: { w: string; f: number }[];
}

export type Repaso = Tema & { escenas: TimedEscena[] };

export const repasoFor = (key: string): Repaso | undefined =>
  (TIMINGS as unknown as Record<string, Repaso>)[key];

const FADE = 9;
const BRAND = new Set(['portada', 'cierre']);

function useLexend() {
  const [handle] = useState(() => delayRender('Lexend'));
  useEffect(() => {
    const font = new FontFace(
      'Lexend',
      `url(${staticFile('fonts/Lexend-VariableFont_wght.ttf')})`,
      { weight: '100 900' }
    );
    font.load().then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    });
  }, [handle]);
}

function Background() {
  const frame = useCurrentFrame();
  const a = Math.sin(frame / 100) * 90;
  const b = Math.cos(frame / 120) * 70;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.navy} 0%, ${C.deep} 75%)` }}>
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          borderRadius: 999,
          left: -380 + a,
          top: -420 + b,
          background: 'radial-gradient(circle, rgba(0,71,186,.5), transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: 999,
          right: -300 - a,
          bottom: -380 - b,
          background: 'radial-gradient(circle, rgba(245,196,0,.13), transparent 65%)',
        }}
      />
    </AbsoluteFill>
  );
}

function SceneFrame({
  frames,
  last,
  children,
}: {
  frames: number;
  last: boolean;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const out = last ? frames + 1 : frames - FADE;
  const opacity = interpolate(frame, [0, FADE, out, out + FADE], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/** Barra de avance del repaso, arriba. */
function Progress({ total }: { total: number }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 8,
        background: 'rgba(255,255,255,.08)',
      }}
    >
      <div style={{ width: `${(frame / total) * 100}%`, height: '100%', background: C.yellow }} />
    </div>
  );
}

// Volumen de la música bajo la voz (0.1 hasta el 20/11).
const MUSICA = 0.04;

export function Video({ repaso }: { repaso: string }) {
  useLexend();
  const { durationInFrames } = useVideoConfig();
  const data = repasoFor(repaso);
  const timings = data?.escenas ?? [];
  const frame = useCurrentFrame();
  const music = interpolate(
    frame,
    [0, 30, durationInFrames - 90, durationInFrames],
    [0, MUSICA, MUSICA, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  let from = 0;
  return (
    <AbsoluteFill>
      <Background />
      <Audio src={staticFile('musica.wav')} volume={music} loop />
      {timings.map((s, i) => {
        const Scene = SCENES[s.tipo];
        const start = from;
        from += s.frames;
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.frames}>
            <SceneFrame frames={s.frames} last={i === timings.length - 1}>
              <Scene {...s} meta={data!} />
              {!BRAND.has(s.tipo) && (
                <Img
                  src={staticFile('brand/alba-isotipo-white.png')}
                  style={{ position: 'absolute', top: 70, right: 90, width: 64, opacity: 0.85 }}
                />
              )}
            </SceneFrame>
            <Sequence from={s.lead}>
              <Audio src={staticFile(s.audio)} />
            </Sequence>
            <Captions chunks={s.chunks} start={s.lead} />
          </Sequence>
        );
      })}
      <Progress total={durationInFrames} />
    </AbsoluteFill>
  );
}
