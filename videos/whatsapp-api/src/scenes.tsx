import type { ReactNode } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import {
  Bubble,
  Card,
  ChatGlyph,
  Check,
  Phone,
  Pill,
  Rise,
  Title,
  staticSrc,
  useIn,
} from './components';
import { C, FONT } from './theme';

export interface SceneProps {
  frames: number;
  voiceFrames: number;
  lead: number;
}

/** Momento de la voz como fracción (0–1) → frame de la escena. */
const at = (p: SceneProps, f: number) => Math.round(p.lead + p.voiceFrames * f);

function Head({
  pill,
  tone,
  title,
}: {
  pill: string;
  tone?: 'yellow' | 'green' | 'white';
  title: ReactNode;
}) {
  return (
    <div style={{ position: 'absolute', top: 150, left: 80, right: 80 }}>
      <Rise delay={0}>
        <Pill tone={tone}>{pill}</Pill>
      </Rise>
      <Rise delay={5}>
        <Title>{title}</Title>
      </Rise>
    </div>
  );
}

const Stage = ({ children, top = 560 }: { children: ReactNode; top?: number }) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    {children}
  </div>
);

// 1 · WhatsApp entra a la plataforma
export function S1(p: SceneProps) {
  const frame = useCurrentFrame();
  const fly = interpolate(frame, [at(p, 0.45), at(p, 0.8)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoIn = useIn(at(p, 0.5));
  const glow = 0.5 + 0.5 * Math.sin(frame / 8);
  return (
    <>
      <Head
        pill="API OFICIAL DE WHATSAPP"
        tone="green"
        title={<>WhatsApp, dentro de la plataforma ALBA</>}
      />
      <Stage top={720}>
        <div style={{ position: 'relative', width: 900, height: 560 }}>
          {[0, 1, 2].map((i) => {
            const startX = 60 + i * 40;
            const startY = 40 + i * 150;
            const x = interpolate(fly, [0, 1], [startX, 560]);
            const y = interpolate(fly, [0, 1], [startY, 200]);
            const s = interpolate(fly, [0, 0.85, 1], [1, 0.7, 0]);
            return (
              <Rise
                key={i}
                delay={10 + i * 6}
                style={{ position: 'absolute', left: x, top: y, transform: `scale(${s})` }}
              >
                <div
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: 999,
                    background: C.wa,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: '0 16px 40px rgba(0,0,0,.3)',
                  }}
                >
                  <ChatGlyph size={80} />
                </div>
              </Rise>
            );
          })}
          <div
            style={{
              position: 'absolute',
              left: 520,
              top: 130,
              width: 300,
              height: 300,
              borderRadius: 999,
              background: C.white,
              display: 'grid',
              placeItems: 'center',
              opacity: logoIn,
              transform: `scale(${0.6 + 0.4 * logoIn})`,
              boxShadow: `0 0 ${40 + 40 * glow * fly}px rgba(245,196,0,${0.55 * fly})`,
            }}
          >
            <img src={staticSrc('brand/alba-isotipo.png')} style={{ width: 200 }} />
          </div>
        </div>
      </Stage>
    </>
  );
}

// 2 · Ya funciona: bot y bandeja
export function S2(p: SceneProps) {
  const toast = useIn(at(p, 0.5));
  const taken = useIn(at(p, 0.78));
  return (
    <>
      <Head pill="YA FUNCIONA" tone="green" title={<>Bot 24/7 y bandeja para asesores</>} />
      <Stage top={600}>
        <div style={{ position: 'relative' }}>
          <Phone>
            <Bubble from="me" delay={at(p, 0.02)}>
              Hola, quiero información sobre los programas
            </Bubble>
            <Bubble from="them" delay={at(p, 0.14)} wide>
              ¡Hola! Soy el asistente de ALBA. ¿En qué te ayudamos?
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {['Programas y precios', 'Cómo inscribirme', 'Hablar con un asesor'].map((o, i) => (
                  <div
                    key={o}
                    style={{
                      border: `2px solid ${C.line}`,
                      borderRadius: 14,
                      padding: '8px 14px',
                      color: C.blue,
                      fontWeight: 600,
                      background: i === 2 ? '#EEF4FF' : 'transparent',
                    }}
                  >
                    {o}
                  </div>
                ))}
              </div>
            </Bubble>
            <Bubble from="me" delay={at(p, 0.36)}>
              Hablar con un asesor
            </Bubble>
          </Phone>
          <div
            style={{
              position: 'absolute',
              left: -60,
              right: -60,
              top: 700,
              opacity: toast,
              transform: `translateY(${(1 - toast) * 60}px)`,
            }}
          >
            <Card style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  background: C.yellow,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ChatGlyph size={40} color={C.ink} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>Nuevo chat esperando</div>
                <div style={{ fontSize: 26, color: C.muted }}>Aviso enviado a los 3 asesores</div>
              </div>
              <div
                style={{
                  background: taken > 0.5 ? C.green : C.blue,
                  color: C.white,
                  borderRadius: 18,
                  padding: '16px 22px',
                  fontSize: 28,
                  fontWeight: 600,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  transform: `scale(${1 + 0.08 * Math.sin(Math.min(1, taken) * Math.PI)})`,
                }}
              >
                {taken > 0.5 ? (
                  <>
                    <Check size={28} color={C.white} /> Tomado
                  </>
                ) : (
                  'Tomar chat'
                )}
              </div>
            </Card>
          </div>
        </div>
      </Stage>
    </>
  );
}

// 3 · Una sola bandeja
export function S3(p: SceneProps) {
  const frame = useCurrentFrame();
  const channels = [
    { name: 'WhatsApp', on: true, color: C.wa },
    { name: 'Instagram', on: false, color: '#C13584' },
    { name: 'Messenger', on: false, color: '#0A7CFF' },
  ];
  const rows = [
    { who: 'Laura M.', ch: 'WhatsApp', msg: 'Ya subí mi certificado', tag: 'BACH-2026-2' },
    { who: 'Andrés P.', ch: 'Instagram', msg: '¿Cuándo empieza el ciclo?', tag: 'Aspirante' },
    { who: 'Diana R.', ch: 'Messenger', msg: 'Gracias por la ayuda', tag: 'BACH-2026-1' },
  ];
  const flow = interpolate(frame, [at(p, 0.25), at(p, 0.55)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <Head pill="PUERTA 1 · MULTICANAL" title={<>Una sola bandeja para todos los canales</>} />
      <Stage top={640}>
        <div style={{ width: 920, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {channels.map((c, i) => (
              <Rise key={c.name} delay={at(p, 0.05) + i * 8}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 30,
                    fontWeight: 600,
                    color: C.white,
                    background: c.on ? c.color : 'rgba(255,255,255,.12)',
                    border: c.on ? 'none' : `3px dashed ${c.color}`,
                    borderRadius: 999,
                    padding: '16px 28px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <ChatGlyph size={32} />
                  {c.name}
                  {!c.on && (
                    <span style={{ fontSize: 20, color: C.yellow, fontWeight: 700 }}>PRÓXIMO</span>
                  )}
                </div>
              </Rise>
            ))}
          </div>
          <svg width={920} height={150} style={{ overflow: 'visible' }}>
            {[150, 460, 770].map((x, i) => (
              <path
                key={x}
                d={`M ${x} 0 C ${x} 80, 460 60, 460 150`}
                stroke={i === 0 ? C.wa : 'rgba(255,255,255,.45)'}
                strokeWidth={6}
                fill="none"
                strokeDasharray="400"
                strokeDashoffset={400 * (1 - flow)}
              />
            ))}
          </svg>
          <Rise delay={at(p, 0.45)} style={{ width: '100%' }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  background: C.canvas,
                  padding: '22px 30px',
                  fontSize: 30,
                  fontWeight: 700,
                  color: C.navy,
                  borderBottom: `2px solid ${C.line}`,
                }}
              >
                Mensajes · ALBA
              </div>
              {rows.map((r, i) => (
                <Rise key={r.who} delay={at(p, 0.55) + i * 7} y={20}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 22,
                      padding: '22px 30px',
                      borderBottom: i < 2 ? `2px solid ${C.line}` : 'none',
                    }}
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
                        fontWeight: 700,
                        fontSize: 28,
                      }}
                    >
                      {r.who[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 30, fontWeight: 600 }}>
                        {r.who}{' '}
                        <span style={{ fontSize: 22, color: C.muted, fontWeight: 400 }}>
                          · {r.ch}
                        </span>
                      </div>
                      <div style={{ fontSize: 26, color: C.muted }}>{r.msg}</div>
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 600,
                        color: C.blue,
                        background: '#DCE7FA',
                        borderRadius: 999,
                        padding: '8px 16px',
                      }}
                    >
                      {r.tag}
                    </div>
                  </div>
                </Rise>
              ))}
            </Card>
          </Rise>
        </div>
      </Stage>
    </>
  );
}

// 4 · Pagos en línea
export function S4(p: SceneProps) {
  return (
    <>
      <Head pill="PUERTA 2 · PAGOS" title={<>El pago de la cuota, en el mismo chat</>} />
      <Stage top={600}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
          <Phone>
            <Bubble from="them" delay={at(p, 0.3)} wide>
              Hola, Laura. Tu cuota 3 de 6 vence el 15 de diciembre.
            </Bubble>
            <Rise delay={at(p, 0.42)} style={{ alignSelf: 'flex-start', width: '88%' }}>
              <div
                style={{
                  background: C.white,
                  borderRadius: 26,
                  overflow: 'hidden',
                  fontFamily: FONT,
                  boxShadow: '0 2px 4px rgba(0,0,0,.08)',
                }}
              >
                <div
                  style={{
                    background: C.navy,
                    color: C.white,
                    padding: '22px 24px',
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  Pagar mi cuota
                </div>
                <div style={{ padding: '18px 24px', fontSize: 26, color: C.muted }}>
                  Pago seguro con Wompi
                </div>
                <div
                  style={{
                    margin: '0 24px 22px',
                    background: C.blue,
                    color: C.white,
                    borderRadius: 16,
                    padding: '14px',
                    textAlign: 'center',
                    fontSize: 28,
                    fontWeight: 600,
                  }}
                >
                  Abrir enlace de pago
                </div>
              </div>
            </Rise>
            <Bubble from="them" delay={at(p, 0.78)}>
              <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                <Check size={30} /> Recibimos tu pago. ¡Gracias!
              </span>
            </Bubble>
          </Phone>
          <Rise delay={at(p, 0.6)}>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 26,
                color: 'rgba(255,255,255,.75)',
                textAlign: 'center',
              }}
            >
              WhatsApp Pay aún no opera en Colombia; el enlace de pago sí.
            </div>
          </Rise>
        </div>
      </Stage>
    </>
  );
}

// 5 · Gestión de cuenta
export function S5(p: SceneProps) {
  const items = [
    { t: 'Recordatorio: tu cuota vence en 3 días', live: false },
    { t: 'Hoy hay clase en vivo a las 7:00 p. m.', live: false },
    { t: 'Tienes otra oportunidad en el examen', live: true },
  ];
  return (
    <>
      <Head pill="PUERTA 3 · CUENTA" title={<>La cuenta del estudiante, por WhatsApp</>} />
      <Stage top={600}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <Phone>
            <Bubble from="me" delay={at(p, 0.12)}>
              saldo
            </Bubble>
            <Rise delay={at(p, 0.2)} style={{ alignSelf: 'flex-start', width: '88%' }}>
              <div
                style={{
                  background: C.white,
                  borderRadius: 26,
                  padding: '22px 24px',
                  fontFamily: FONT,
                  boxShadow: '0 2px 4px rgba(0,0,0,.08)',
                }}
              >
                <div style={{ fontSize: 30, fontWeight: 700, color: C.navy }}>Tu cuenta</div>
                <div style={{ fontSize: 27, marginTop: 10 }}>2 de 6 cuotas pagadas</div>
                <div
                  style={{
                    height: 16,
                    background: C.line,
                    borderRadius: 999,
                    marginTop: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: '33%', height: '100%', background: C.green }} />
                </div>
                <div style={{ fontSize: 27, marginTop: 12, color: C.muted }}>
                  Próxima: 15 de diciembre · Al día
                </div>
              </div>
            </Rise>
            {items.map((it, i) => (
              <Rise
                key={it.t}
                delay={at(p, 0.42) + i * 10}
                style={{ alignSelf: 'flex-start', width: '92%' }}
              >
                <div
                  style={{
                    background: C.white,
                    borderRadius: 22,
                    padding: '16px 20px',
                    fontFamily: FONT,
                    fontSize: 26,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    boxShadow: '0 2px 4px rgba(0,0,0,.08)',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: it.live ? C.green : C.yellow,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1 }}>{it.t}</span>
                  {it.live && (
                    <span style={{ fontSize: 18, fontWeight: 700, color: C.green }}>
                      YA FUNCIONA
                    </span>
                  )}
                </div>
              </Rise>
            ))}
          </Phone>
          <Rise delay={at(p, 0.3)}>
            <div style={{ fontFamily: FONT, fontSize: 24, color: 'rgba(255,255,255,.6)' }}>
              Ejemplo ilustrativo
            </div>
          </Rise>
        </div>
      </Stage>
    </>
  );
}

// 6 · Costos
export function S6(p: SceneProps) {
  const frame = useCurrentFrame();
  const bar = interpolate(frame, [at(p, 0.05), at(p, 0.45)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <>
      <Head pill="COSTOS" title={<>Pagamos solo lo que enviamos</>} />
      <Stage top={600}>
        <div
          style={{
            width: 920,
            display: 'flex',
            flexDirection: 'column',
            gap: 40,
            fontFamily: FONT,
          }}
        >
          <Rise delay={at(p, 0.05)}>
            <Card>
              <div style={{ fontSize: 30, color: C.muted }}>Respuestas dentro de las 24 horas</div>
              <div style={{ fontSize: 170, fontWeight: 700, color: C.green, lineHeight: 1.1 }}>
                $0
              </div>
              <div
                style={{ height: 22, background: C.line, borderRadius: 999, overflow: 'hidden' }}
              >
                <div style={{ width: `${bar * 100}%`, height: '100%', background: C.wa }} />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 22,
                  color: C.muted,
                  marginTop: 8,
                }}
              >
                <span>Te escriben</span>
                <span>24 h</span>
              </div>
            </Card>
          </Rise>
          <Rise delay={at(p, 0.55)}>
            <Card>
              <div style={{ fontSize: 30, color: C.muted }}>Avisos fuera de esa ventana</div>
              <div
                style={{
                  fontSize: 60,
                  fontWeight: 700,
                  color: C.navy,
                  marginTop: 6,
                  lineHeight: 1.15,
                }}
              >
                Plantilla: se paga por mensaje
              </div>
              <div style={{ fontSize: 26, color: C.muted, marginTop: 14 }}>
                Recordatorios, avisos a asesores, otra oportunidad
              </div>
            </Card>
          </Rise>
        </div>
      </Stage>
    </>
  );
}

// 7 · Cierre
export function S7(p: SceneProps) {
  const lines = ['Un número.', 'Una plataforma.', 'Todo medido.'];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        paddingBottom: 260,
      }}
    >
      {lines.map((l, i) => (
        <Rise key={l} delay={at(p, 0.02 + i * 0.13)}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 92,
              fontWeight: 700,
              color: C.white,
              letterSpacing: -1,
            }}
          >
            {l}
          </div>
        </Rise>
      ))}
      <Rise delay={at(p, 0.5)} style={{ marginTop: 70 }}>
        <img src={staticSrc('brand/alba-logo-horizontal-white.png')} style={{ width: 720 }} />
      </Rise>
      <Rise delay={at(p, 0.72)}>
        <div style={{ fontFamily: FONT, fontSize: 48, fontWeight: 600, color: C.yellow }}>
          Aprender es avanzar.
        </div>
      </Rise>
    </div>
  );
}
