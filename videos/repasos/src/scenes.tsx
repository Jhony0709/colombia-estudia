import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  Card,
  Check,
  Head,
  Label,
  Pill,
  PopCard,
  Rise,
  Stage,
  cue,
  useIn,
  useSpan,
  type Foco,
  type Imagen as Ilustracion,
  type Item,
  type SceneProps,
} from './components';
import { C, FONT } from './theme';

/** Frame de entrada de cada ítem: su palabra, o repartidos a lo largo de la voz. */
const cuesOf = (p: SceneProps, items: Item[]) =>
  items.map((it, i) => cue(p, it, (i + 1) / (items.length + 1)));

function Pop({
  delay,
  children,
  style,
}: {
  delay: number;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const p = useIn(delay, 13);
  return (
    <div
      style={{ position: 'absolute', opacity: p, transform: `scale(${0.6 + 0.4 * p})`, ...style }}
    >
      {children}
    </div>
  );
}

function Ring({ start, top = '45%' }: { start: number; top?: string }) {
  const ring = useSpan(start, start + 45);
  return (
    <div
      style={{
        position: 'absolute',
        width: 300 + 1300 * ring,
        height: 300 + 1300 * ring,
        borderRadius: 9999,
        border: `6px solid ${C.yellow}`,
        opacity: ring > 0 ? 0.5 * (1 - ring) : 0,
        top,
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function Logo({ start, width = 520 }: { start: number; width?: number }) {
  const logo = useIn(start, 14);
  const wipe = useSpan(start + 2, start + 26);
  return (
    <div
      style={{
        opacity: logo,
        transform: `scale(${0.85 + 0.15 * logo})`,
        clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
      }}
    >
      <Img src={staticFile('brand/alba-logo-horizontal-white.png')} style={{ width }} />
    </div>
  );
}

// Entrada de marca: logo, tema y área.
export function Portada(p: SceneProps) {
  const line = useSpan(22, 44);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 140 }}>
      <Ring start={0} top="40%" />
      <Logo start={2} />
      <div
        style={{
          width: 460 * line,
          height: 6,
          borderRadius: 3,
          background: C.yellow,
          margin: '26px 0 40px',
        }}
      />
      <Rise delay={cue(p, 'repaso')}>
        <Pill>{p.meta.etiqueta ?? 'Repaso del tema'}</Pill>
      </Rise>
      <Rise delay={cue(p, 'tema') + 4}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 84,
            color: C.white,
            letterSpacing: -1.5,
            marginTop: 18,
            textAlign: 'center',
            maxWidth: 1500,
            lineHeight: 1.08,
          }}
        >
          {p.meta.titulo}
        </div>
      </Rise>
      <Rise delay={cue(p, 'tema') + 14}>
        <div
          style={{ fontFamily: FONT, fontSize: 32, color: 'rgba(255,255,255,.8)', marginTop: 22 }}
        >
          {p.meta.componente} · {p.meta.area}
        </div>
      </Rise>
    </AbsoluteFill>
  );
}

// Línea de tiempo: fechas o momentos, de izquierda a derecha.
export function Linea(p: SceneProps) {
  const items = p.items ?? [];
  const at = cuesOf(p, items);
  const line = useSpan(at[0] - 6, at[at.length - 1]);
  const W = 1680;
  const step = W / items.length;
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <Stage>
        <div style={{ position: 'relative', width: W, height: 440 }}>
          <div
            style={{
              position: 'absolute',
              left: step / 2,
              top: 40,
              height: 6,
              width: (W - step) * line,
              background: C.yellow,
              borderRadius: 3,
            }}
          />
          {items.map((it, i) => (
            <Pop key={i} delay={at[i]} style={{ left: i * step + 12, top: 20, width: step - 24 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  margin: '0 auto',
                  borderRadius: 999,
                  background: C.yellow,
                  border: `6px solid ${C.navy}`,
                }}
              />
              <Card style={{ marginTop: 22, padding: '18px 22px', minHeight: 230 }}>
                {it.etiqueta && (
                  <Label size={44} weight={700} color={C.blue}>
                    {it.etiqueta}
                  </Label>
                )}
                <Label size={28}>{it.titulo}</Label>
                {it.texto && (
                  <div style={{ marginTop: 8 }}>
                    <Label size={23} color={C.muted} weight={400}>
                      {it.texto}
                    </Label>
                  </div>
                )}
              </Card>
            </Pop>
          ))}
        </div>
      </Stage>
    </>
  );
}

// Pasos: una cadena con flechas, de lo primero a lo último.
export function Pasos(p: SceneProps) {
  const frame = useCurrentFrame();
  const items = p.items ?? [];
  const at = cuesOf(p, items);
  const flowStart = at[at.length - 1] + 15;
  const lit = frame > flowStart ? Math.floor(((frame - flowStart) / 18) % items.length) : -1;
  const size = items.length > 5 ? 170 : 200;
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <Stage>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {i > 0 && <ArrowIn delay={at[i]} top={size / 2 - 20} />}
              <Rise delay={at[i]} style={{ width: size + 40, textAlign: 'center' }}>
                <div
                  style={{
                    width: size,
                    height: size,
                    margin: '0 auto',
                    borderRadius: 999,
                    background: C.white,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: lit === i ? `0 0 0 10px ${C.yellow}` : '0 20px 50px rgba(0,0,0,.28)',
                    padding: 14,
                  }}
                >
                  <Label size={it.titulo.length > 8 ? 25 : 32} weight={700} color={C.navy}>
                    {it.titulo}
                  </Label>
                </div>
                {it.texto && (
                  <div style={{ marginTop: 14 }}>
                    <Label size={22} color={C.white} weight={400}>
                      {it.texto}
                    </Label>
                  </div>
                )}
              </Rise>
            </div>
          ))}
        </div>
      </Stage>
    </>
  );
}

function ArrowIn({ delay, top }: { delay: number; top: number }) {
  const p = useSpan(delay - 8, delay + 4);
  return (
    <svg width={50} height={40} style={{ marginTop: top, opacity: p }}>
      <path
        d={`M4 20 H${4 + 32 * p} M30 8 L44 20 L30 32`}
        fill="none"
        stroke={C.yellow}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Ciclo: los ítems alrededor de un anillo que gira.
export function Ciclo(p: SceneProps) {
  const frame = useCurrentFrame();
  const items = p.items ?? [];
  const at = cuesOf(p, items);
  const ring = useSpan(at[0] - 10, at[0] + 20);
  const R = 230;
  const turn = (frame / 4) % 360;
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <Stage>
        <div style={{ position: 'relative', width: 760, height: 580 }}>
          <svg
            width={760}
            height={580}
            style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: ring }}
          >
            <circle
              cx={380}
              cy={290}
              r={R}
              fill="none"
              stroke="rgba(255,255,255,.35)"
              strokeWidth={4}
              strokeDasharray="12 12"
            />
            <g transform={`rotate(${turn} 380 290)`}>
              <path
                d={`M${380 + R} ${290 - 18} l14 22 l-28 0 z`}
                fill={C.yellow}
                transform={`rotate(180 ${380 + R} 290)`}
              />
            </g>
          </svg>
          {items.map((it, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
            return (
              <Pop
                key={i}
                delay={at[i]}
                style={{
                  left: 380 + R * Math.cos(a) - 130,
                  top: 290 + R * Math.sin(a) - 55,
                  width: 260,
                }}
              >
                <Card style={{ textAlign: 'center', padding: '16px 18px' }}>
                  <Label size={28} weight={700} color={C.navy}>
                    {it.titulo}
                  </Label>
                  {it.texto && (
                    <Label size={20} color={C.muted} weight={400}>
                      {it.texto}
                    </Label>
                  )}
                </Card>
              </Pop>
            );
          })}
        </div>
      </Stage>
    </>
  );
}

// Conceptos: tarjetas numeradas, una por idea.
export function Conceptos(p: SceneProps) {
  const items = p.items ?? [];
  const at = cuesOf(p, items);
  const cols = items.length <= 4 ? items.length : 3;
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <Stage>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${cols === 4 ? 380 : 460}px)`,
            gap: 30,
          }}
        >
          {items.map((it, i) => (
            <PopCard
              key={i}
              delay={at[i]}
              style={{ minHeight: 260, display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  background: C.blue,
                  color: C.white,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 32,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <Label size={38} weight={700} color={C.navy}>
                {it.titulo}
              </Label>
              {it.texto && (
                <Label size={26} color={C.muted} weight={400}>
                  {it.texto}
                </Label>
              )}
            </PopCard>
          ))}
        </div>
      </Stage>
    </>
  );
}

// Comparar: dos columnas, cada punto con su visto.
export function Comparar(p: SceneProps) {
  const cols = p.columnas ?? [];
  const vs = useIn(cue(p, cols[1] ?? {}, 0.5));
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <Stage>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 40, position: 'relative' }}>
          {cols.map((col, k) => {
            const start = cue(p, col, k === 0 ? 0.1 : 0.5);
            return (
              <PopCard key={k} delay={start} style={{ width: 720, padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    background: k === 0 ? C.blue : C.green,
                    color: C.white,
                    padding: '20px 30px',
                  }}
                >
                  <Label size={40} weight={700} color={C.white}>
                    {col.titulo}
                  </Label>
                </div>
                <div
                  style={{
                    padding: '22px 30px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  {col.puntos.map((pt, i) => (
                    <Point key={i} delay={cue(p, pt, 0.2 + 0.1 * i)} text={pt.texto} />
                  ))}
                </div>
              </PopCard>
            );
          })}
          {cols.length === 2 && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) scale(${vs})`,
                width: 72,
                height: 72,
                borderRadius: 999,
                background: C.yellow,
                display: 'grid',
                placeItems: 'center',
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: 28,
                color: C.ink,
              }}
            >
              vs
            </div>
          )}
        </div>
      </Stage>
    </>
  );
}

function Point({ delay, text }: { delay: number; text: string }) {
  const frame = useCurrentFrame();
  const p = useIn(delay);
  const tick = interpolate(frame, [delay + 4, delay + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: p,
        transform: `translateX(${(1 - p) * 24}px)`,
      }}
    >
      <Check size={34} progress={tick} />
      <Label size={30} weight={500}>
        {text}
      </Label>
    </div>
  );
}

// Cierre de marca: tema repasado, siguiente paso y logo.
export function Cierre(p: SceneProps) {
  const end = p.lead + p.voiceFrames;
  const swap = useSpan(end, end + 18);
  const circle = useSpan(4, 24);
  const tick = useSpan(18, 34);
  const line = useSpan(end + 24, end + 46);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          opacity: 1 - swap,
          transform: `translateY(${-40 * swap}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: 140,
        }}
      >
        <svg width={170} height={170} viewBox="0 0 170 170">
          <circle
            cx={85}
            cy={85}
            r={76}
            fill="none"
            stroke={C.yellow}
            strokeWidth={8}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - circle}
            transform="rotate(-90 85 85)"
          />
          <path
            d="M50 88 L75 112 L122 62"
            fill="none"
            stroke={C.white}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - tick}
          />
        </svg>
        <Rise delay={cue(p, 'repasaste', 0.2)}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 92,
              color: C.white,
              letterSpacing: -2,
              marginTop: 26,
            }}
          >
            {p.meta.cierre ?? '¡Tema repasado!'}
          </div>
        </Rise>
        {p.meta.siguiente && (
          <Rise delay={cue(p, 'sigue', 0.6)}>
            <div style={{ marginTop: 28 }}>
              <Pill>Siguiente: {p.meta.siguiente}</Pill>
            </div>
          </Rise>
        )}
      </div>
      <Ring start={end + 4} top="50%" />
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: swap,
        }}
      >
        <Logo start={end + 6} width={640} />
        <div
          style={{
            width: 520 * line,
            height: 6,
            borderRadius: 3,
            background: C.yellow,
            marginTop: 28,
          }}
        />
        <div
          style={{ marginTop: 26, opacity: line, fontFamily: FONT, fontSize: 32, color: C.white }}
        >
          albafuturoeducativo.com
        </div>
      </div>
    </AbsoluteFill>
  );
}

interface Toma {
  at: number;
  zoom: number;
  x: number;
  y: number;
}

const ENTERA = { zoom: 1, x: 0.5, y: 0.5 };

/** La cámara en `frame`: va de una toma a la siguiente en 24 frames, con suavizado. */
function camara(tomas: Toma[], frame: number) {
  let prev: Omit<Toma, 'at'> = ENTERA;
  let cur: Omit<Toma, 'at'> = ENTERA;
  let at = 0;
  for (const t of tomas) {
    if (t.at > frame) break;
    prev = cur;
    cur = t;
    at = t.at;
  }
  const k = interpolate(frame, [at, at + 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const mix = (a: number, b: number) => a + (b - a) * e;
  const zoom = mix(prev.zoom, cur.zoom);
  // Sin salirse de la imagen: el centro no se acerca al borde más de media pantalla.
  const lim = (v: number) => Math.min(1 - 0.5 / zoom, Math.max(0.5 / zoom, v));
  return { zoom, x: lim(mix(prev.x, cur.x)), y: lim(mix(prev.y, cur.y)) };
}

function Lienzo({ im, p, from, to }: { im: Ilustracion; p: SceneProps; from: number; to: number }) {
  const frame = useCurrentFrame();
  const enter = useIn(from + 4, 16);
  const out = interpolate(frame, [to, to + 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const focos = im.focos ?? [];
  const end = p.lead + p.voiceFrames;
  const tomas: Toma[] = [
    ...focos.map((f: Foco, i) => ({
      // Arranca un poco antes de la palabra para llegar cuando se oye.
      at: cue(p, f, (i + 1) / (focos.length + 1)) - 8,
      zoom: f.zoom ?? 1.7,
      x: f.x,
      y: f.y,
    })),
    // Solo la última imagen vuelve a verse entera; las demás pasan a la siguiente desde su foco.
    ...(focos.length && to > end ? [{ at: end - 6, ...ENTERA }] : []),
  ].sort((a, b) => a.at - b.at);
  // Sin focos, un acercamiento lento y continuo.
  const drift = focos.length
    ? 1
    : interpolate(frame, [from, to], [1, 1.08], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
  const cam = camara(tomas, frame);
  return (
    <div
      style={{
        position: 'absolute',
        opacity: enter * out,
        transform: `scale(${0.94 + 0.06 * enter})`,
        height: 640,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        background: C.canvas,
      }}
    >
      <Img
        src={staticFile(`imagenes/${im.src}`)}
        style={{
          display: 'block',
          height: 640,
          width: 'auto',
          transform: `scale(${cam.zoom * drift}) translate(${(0.5 - cam.x) * 100}%, ${(0.5 - cam.y) * 100}%)`,
        }}
      />
    </div>
  );
}

// Ilustraciones del tema (20/11): cada una entra con su palabra y la cámara se acerca a cada
// foco cuando la voz lo nombra. Los rótulos vienen en la imagen.
export function Imagen(p: SceneProps) {
  const imgs = p.imagenes ?? [];
  const starts = imgs.map((im, i) => (i === 0 ? 0 : cue(p, im, i / imgs.length)));
  return (
    <>
      <Head area={p.meta.area} titulo={p.titulo} />
      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          top: 250,
          bottom: 165,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {imgs.map((im, i) => (
          <Lienzo
            key={im.src}
            im={im}
            p={p}
            from={starts[i]!}
            to={starts[i + 1] ?? p.frames + 20}
          />
        ))}
      </div>
    </>
  );
}

export const SCENES: Record<SceneProps['tipo'], (p: SceneProps) => JSX.Element> = {
  portada: Portada,
  linea: Linea,
  pasos: Pasos,
  ciclo: Ciclo,
  conceptos: Conceptos,
  comparar: Comparar,
  imagen: Imagen,
  cierre: Cierre,
};
