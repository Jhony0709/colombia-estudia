import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';

/** Entrada con resorte a partir de `delay` (frames): 0 → 1. */
export function useIn(delay = 0, damping = 16) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140, mass: 0.7 } });
}

export function Rise({
  delay = 0,
  y = 40,
  children,
  style,
}: {
  delay?: number;
  y?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const p = useIn(delay);
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * y}px) scale(${0.96 + 0.04 * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = 'yellow',
}: {
  children: ReactNode;
  tone?: 'yellow' | 'green' | 'white';
}) {
  const bg = tone === 'yellow' ? C.yellow : tone === 'green' ? C.wa : C.white;
  const fg = tone === 'white' ? C.navy : C.ink;
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: fg,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 3,
        padding: '12px 26px',
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 76,
        lineHeight: 1.08,
        color: C.white,
        margin: '28px 0 0',
        letterSpacing: -1,
      }}
    >
      {children}
    </h1>
  );
}

/** Ícono genérico de chat (no es el logo de ninguna marca). */
export function ChatGlyph({ size = 64, color = C.white }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function Check({ size = 30, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Teléfono con fondo de chat. */
export function Phone({
  children,
  header = 'ALBA Futuro Educativo',
}: {
  children: ReactNode;
  header?: string;
}) {
  return (
    <div
      style={{
        width: 720,
        height: 900,
        borderRadius: 64,
        background: C.ink,
        padding: 18,
        boxShadow: '0 40px 90px rgba(0,0,0,.45)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 48,
          overflow: 'hidden',
          background: C.waBg,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: C.navy,
            color: C.white,
            fontFamily: FONT,
            padding: '30px 30px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 999,
              background: C.white,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img src={staticSrc('brand/alba-isotipo.png')} style={{ width: 44 }} />
          </div>
          <div>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{header}</div>
            <div style={{ fontSize: 22, opacity: 0.75 }}>Cuenta de empresa</div>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: '26px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Bubble({
  from,
  delay,
  children,
  wide = false,
}: {
  from: 'me' | 'them';
  delay: number;
  children: ReactNode;
  wide?: boolean;
}) {
  const p = useIn(delay, 14);
  const me = from === 'me';
  return (
    <div
      style={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: wide ? '92%' : '80%',
        background: me ? C.waBubble : C.white,
        color: C.ink,
        fontFamily: FONT,
        fontSize: 29,
        lineHeight: 1.3,
        padding: '16px 22px',
        borderRadius: 26,
        borderTopRightRadius: me ? 6 : 26,
        borderTopLeftRadius: me ? 26 : 6,
        boxShadow: '0 2px 4px rgba(0,0,0,.08)',
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px) scale(${0.9 + 0.1 * p})`,
        transformOrigin: me ? 'bottom right' : 'bottom left',
      }}
    >
      {children}
    </div>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 32,
        padding: '28px 32px',
        fontFamily: FONT,
        color: C.ink,
        boxShadow: '0 24px 60px rgba(0,0,0,.25)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Subtítulos: la frase del momento, repartida por longitud a lo largo de la voz. */
export function Captions({ text, start, frames }: { text: string; start: number; frames: number }) {
  const frame = useCurrentFrame();
  const chunks = splitChunks(text);
  const totalChars = chunks.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  let current = chunks[chunks.length - 1];
  for (const c of chunks) {
    const end = start + ((acc + c.length) / totalChars) * frames;
    if (frame < end) {
      current = c;
      break;
    }
    acc += c.length;
  }
  const opacity = interpolate(frame, [start - 4, start + 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        right: 70,
        bottom: 150,
        display: 'flex',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          background: 'rgba(8,28,69,.82)',
          color: C.white,
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 44,
          lineHeight: 1.3,
          textAlign: 'center',
          padding: '18px 30px',
          borderRadius: 24,
        }}
      >
        {current}
      </div>
    </div>
  );
}

function splitChunks(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.:;])\s+/)) {
    const words = sentence.split(' ');
    const parts = Math.ceil(sentence.length / 46);
    const per = Math.ceil(words.length / parts);
    for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
  }
  return out;
}

export const staticSrc = (p: string) => staticFile(p);
