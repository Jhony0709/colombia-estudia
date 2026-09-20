/**
 * WebVTT → cues. Puro, sin DOM: lo usa el servidor para mandar la transcripción sincronizada
 * ya parseada, y se prueba con una cadena escrita a mano.
 * SSOT: plan/08-aprender-y-evaluar.md:24-26 (transcripción sincronizada, clic lleva al segundo).
 *
 * Acepta lo que produce cualquier editor de subtítulos: `HH:MM:SS.mmm` o `MM:SS.mmm`, con
 * o sin identificador de cue, con ajustes de posición tras la flecha (se ignoran), y con
 * etiquetas de voz o estilo (`<v Ana>`, `<i>`) que se quitan del texto. Lo que no sea un
 * cue válido se salta en silencio: una línea rara no puede dejar al estudiante sin
 * transcripción.
 */

export interface Cue {
  /** Segundos desde el inicio. */
  start: number;
  end: number;
  text: string;
}

const TIME = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

export function parseTimestamp(raw: string): number | null {
  const m = TIME.exec(raw.trim());
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return (
    Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss) + Number((ms ?? '0').padEnd(3, '0')) / 1000
  );
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

export function parseWebVtt(input: string): Cue[] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    // Cabecera, notas y estilos no son cues.
    if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(lines[0]!)) continue;

    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex === -1) continue;
    const [left, right] = lines[timingIndex]!.split('-->');
    const start = parseTimestamp(left ?? '');
    const end = parseTimestamp((right ?? '').trim().split(/\s+/)[0] ?? '');
    if (start === null || end === null || end < start) continue;

    const body = lines
      .slice(timingIndex + 1)
      .map(stripTags)
      .filter(Boolean)
      .join(' ');
    if (body === '') continue;

    cues.push({ start, end, text: body });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** `mm:ss` (o `h:mm:ss`) para pintar al lado de cada cue. */
export function formatCueTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${h > 0 ? m.toString().padStart(2, '0') : m}:${sec.toString().padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
