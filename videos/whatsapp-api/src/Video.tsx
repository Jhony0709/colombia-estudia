import {
  AbsoluteFill,
  Audio,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { useEffect, useState } from 'react';
import { Captions, staticSrc } from './components';
import { S1, S2, S3, S4, S5, S6, S7, type SceneProps } from './scenes';
import { C } from './theme';
import timings from './timings.json';

const SCENES: Record<string, (p: SceneProps) => JSX.Element> = {
  s1: S1,
  s2: S2,
  s3: S3,
  s4: S4,
  s5: S5,
  s6: S6,
  s7: S7,
};
const FADE = 8;

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
  const a = Math.sin(frame / 90) * 80;
  const b = Math.cos(frame / 110) * 90;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.navy} 0%, ${C.deep} 70%)` }}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: 999,
          left: -300 + a,
          top: -250 + b,
          background: 'radial-gradient(circle, rgba(0,71,186,.55), transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: 999,
          right: -320 - a,
          bottom: 120 - b,
          background: 'radial-gradient(circle, rgba(245,196,0,.16), transparent 65%)',
        }}
      />
    </AbsoluteFill>
  );
}

function SceneFrame({ frames, children }: { frames: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, FADE, frames - FADE, frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Video() {
  useLexend();
  let from = 0;
  return (
    <AbsoluteFill>
      <Background />
      <img
        src={staticSrc('brand/alba-isotipo-white.png')}
        style={{ position: 'absolute', top: 60, right: 70, width: 70, opacity: 0.9 }}
      />
      <Audio src={staticFile('musica.wav')} volume={0.12} />
      {timings.map((s) => {
        const Scene = SCENES[s.id];
        const start = from;
        from += s.frames;
        const isLast = s.id === 's7';
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.frames}>
            {isLast ? (
              <AbsoluteFill>
                <Scene {...s} />
              </AbsoluteFill>
            ) : (
              <SceneFrame frames={s.frames}>
                <Scene {...s} />
              </SceneFrame>
            )}
            <Sequence from={s.lead}>
              <Audio src={staticFile(`voz/${s.id}.wav`)} />
            </Sequence>
            {!isLast && <Captions text={s.sub} start={s.lead} frames={s.voiceFrames} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
