import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from './theme';

export interface Chunk {
  text: string;
  from: number;
  to: number;
}

/** Algo que aparece cuando la voz dice `palabra` (la vez número `vez`, desde 0). */
export interface Cue {
  palabra?: string;
  vez?: number;
}

export interface Item extends Cue {
  titulo: string;
  texto?: string;
  etiqueta?: string;
}

export interface Columna extends Cue {
  titulo: string;
  puntos: Array<Cue & { texto: string }>;
}

/** Un punto de la imagen (fracciones de su ancho y alto) al que la cámara se acerca; `zoom` 1 vuelve a verla entera. */
export interface Foco extends Cue {
  x: number;
  y: number;
  zoom?: number;
}

/** Una ilustración del contenido (`public/imagenes/<componente>/<id>.webp`); entra con su palabra. */
export interface Imagen extends Cue {
  src: string;
  focos?: Foco[];
}

export interface Escena {
  id: string;
  tipo: 'portada' | 'linea' | 'pasos' | 'ciclo' | 'conceptos' | 'comparar' | 'imagen' | 'cierre';
  titulo?: string;
  texto: string;
  voz: string;
  items?: Item[];
  columnas?: Columna[];
  imagenes?: Imagen[];
}

export interface Tema {
  tema: string;
  componente: string;
  area: string;
  titulo: string;
  siguiente?: string;
}

export interface SceneProps extends Escena {
  frames: number;
  voiceFrames: number;
  lead: number;
  words: { w: string; f: number }[];
  meta: Tema;
}

/** Momento de la voz como fracción (0–1) → frame de la escena. */
export const at = (p: SceneProps, f: number) => Math.round(p.lead + p.voiceFrames * f);

/** Frame de la escena en que la voz dice `palabra`; sin palabra, `fallback` (fracción). */
export function cue(p: SceneProps, c: Cue | string, fallback = 0) {
  const { palabra, vez = 0 } = typeof c === 'string' ? { palabra: c } : c;
  if (!palabra) return at(p, fallback);
  const hits = p.words.filter((x) => x.w === palabra.toLowerCase());
  const hit = hits[vez] ?? hits[hits.length - 1];
  return hit ? p.lead + hit.f : at(p, fallback);
}

/** Entrada con resorte a partir de `delay` (frames): 0 → 1. */
export function useIn(delay = 0, damping = 15) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 130, mass: 0.7 } });
}

/** Progreso lineal entre dos frames, sin salirse de 0–1. */
export function useSpan(from: number, to: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function Rise({
  delay = 0,
  y = 36,
  children,
  style,
}: {
  delay?: number;
  y?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const p = useIn(delay);
  const { transform, ...rest } = style ?? {};
  return (
    <div
      style={{
        opacity: p,
        transform: `${transform ?? ''} translateY(${(1 - p) * y}px) scale(${0.95 + 0.05 * p})`,
        ...rest,
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
  tone?: 'yellow' | 'white';
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: tone === 'yellow' ? C.yellow : C.white,
        color: tone === 'yellow' ? C.ink : C.navy,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 3,
        textTransform: 'uppercase',
        padding: '10px 24px',
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

export const Label = ({
  children,
  size = 30,
  color = C.ink,
  weight = 600,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  weight?: number;
}) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, color, lineHeight: 1.2 }}>
    {children}
  </div>
);

/** Encabezado de escena: área y título, arriba a la izquierda. */
export function Head({ area, titulo }: { area: string; titulo?: string }) {
  return (
    <div style={{ position: 'absolute', top: 80, left: 120, right: 260 }}>
      <Rise>
        <Pill>{area}</Pill>
      </Rise>
      {titulo && (
        <Rise delay={5}>
          <h1
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 64,
              lineHeight: 1.08,
              color: C.white,
              margin: '22px 0 0',
              letterSpacing: -1,
            }}
          >
            {titulo}
          </h1>
        </Rise>
      )}
    </div>
  );
}

/** Zona del dibujo: todo el ancho, debajo del encabezado y encima de los subtítulos. */
export const Stage = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      position: 'absolute',
      left: 120,
      right: 120,
      top: 300,
      height: 580,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {children}
  </div>
);

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.white,
        borderRadius: 28,
        padding: '22px 28px',
        fontFamily: FONT,
        color: C.ink,
        boxShadow: '0 20px 50px rgba(0,0,0,.28)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Tarjeta que aparece con resorte en `delay`. */
export function PopCard({
  delay,
  children,
  style,
}: {
  delay: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const p = useIn(delay, 13);
  return (
    <Card style={{ opacity: p, transform: `scale(${0.7 + 0.3 * p})`, ...style }}>{children}</Card>
  );
}

export function Check({
  size = 30,
  color = C.green,
  progress = 1,
}: {
  size?: number;
  color?: string;
  progress?: number;
}) {
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
      <path
        d="M20 6 9 17l-5-5"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
}

/** Subtítulos con los tiempos de la voz (frames relativos al inicio de la voz). */
export function Captions({ chunks, start }: { chunks: Chunk[]; start: number }) {
  const frame = useCurrentFrame() - start;
  const current = chunks.find((c) => frame < c.to) ?? chunks[chunks.length - 1];
  const end = chunks[chunks.length - 1].to;
  const opacity = interpolate(frame, [-4, 4, end + 12, end + 22], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 160,
        right: 160,
        bottom: 56,
        display: 'flex',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          background: 'rgba(8,28,69,.86)',
          color: C.white,
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.3,
          textAlign: 'center',
          padding: '14px 30px',
          borderRadius: 20,
        }}
      >
        {current.text}
      </div>
    </div>
  );
}
