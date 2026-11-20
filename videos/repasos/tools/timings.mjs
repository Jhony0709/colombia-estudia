// Tiempos de cada escena a partir de las voces en public/voz/<tema>/<voz>/ → src/timings/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { temas } from './temas.mjs';

const FPS = 30;
const LEAD = 10; // frames antes de que empiece la voz
const TAIL = 18; // frames después
const LAST_TAIL = 150; // el cierre de marca necesita más aire
const MAX_CHARS = 52;

const sentences = (t) => t.split(/(?<=[.:;?!])\s+/).filter(Boolean);

function duration(file) {
  const out = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number(out.toString().trim());
}

// Momento (s) en que empieza y termina cada frase de `voz`, con la alineación de ElevenLabs.
function sentenceTimes(voz, alignment, total) {
  const parts = sentences(voz);
  if (!alignment) {
    const n = parts.reduce((a, s) => a + s.length, 0);
    let acc = 0;
    return parts.map((s) => {
      const from = (acc / n) * total;
      acc += s.length;
      return { from, to: (acc / n) * total };
    });
  }
  const text = alignment.characters.join('');
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  let cursor = 0;
  return parts.map((s) => {
    const i = Math.max(text.indexOf(s, cursor), cursor);
    const j = Math.min(i + s.length - 1, ends.length - 1);
    cursor = j + 1;
    return { from: starts[i] ?? 0, to: ends[j] ?? total };
  });
}

// Trozos de subtítulo de `texto`, repartidos dentro de cada frase por longitud.
function chunks(texto, voz, alignment, total) {
  const shown = sentences(texto);
  const times = sentenceTimes(voz, alignment, total);
  if (shown.length !== times.length)
    throw new Error(`texto y voz no tienen las mismas frases: «${texto.slice(0, 40)}…»`);
  const out = [];
  shown.forEach((s, k) => {
    const words = s.split(' ');
    const parts = Math.ceil(s.length / MAX_CHARS);
    const per = Math.ceil(words.length / parts);
    const pieces = [];
    for (let i = 0; i < words.length; i += per) pieces.push(words.slice(i, i + per).join(' '));
    const { from, to } = times[k];
    const n = pieces.reduce((a, p) => a + p.length, 0);
    let acc = 0;
    for (const p of pieces) {
      const a = from + ((to - from) * acc) / n;
      acc += p.length;
      out.push({
        text: p,
        from: Math.round(a * FPS),
        to: Math.round((from + ((to - from) * acc) / n) * FPS),
      });
    }
  });
  return out;
}

// Frame (desde el inicio de la voz) en que empieza cada palabra de `voz`.
function words(voz, alignment, total) {
  const starts = alignment?.character_start_times_seconds;
  return [...voz.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
    w: m[0].toLowerCase(),
    f: Math.round((starts ? (starts[m.index] ?? total) : (m.index / voz.length) * total) * FPS),
  }));
}

// Subtítulos WebVTT del video completo (para Vimeo y el recurso del tema).
function vtt(scenes) {
  const stamp = (f) => {
    const ms = Math.round((f / FPS) * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
    const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
    return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const cues = [];
  let offset = 0;
  for (const s of scenes) {
    for (const c of s.chunks)
      cues.push(
        `${stamp(offset + s.lead + c.from)} --> ${stamp(offset + s.lead + c.to)}\n${c.text}`
      );
    offset += s.frames;
  }
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

mkdirSync('out', { recursive: true });
const ready = [];
for (const guion of temas()) {
  const base = `public/voz/${guion.tema}`;
  const voices = existsSync(base) ? readdirSync(base).filter((d) => !d.startsWith('.')) : [];
  for (const voice of voices) {
    const dir = `${base}/${voice}`;
    const escenas = [];
    for (const [n, s] of guion.escenas.entries()) {
      const ext = ['mp3', 'wav'].find((e) => existsSync(`${dir}/${s.id}.${e}`));
      if (!ext) break;
      const alignFile = `${dir}/${s.id}.json`;
      const alignment = existsSync(alignFile) ? JSON.parse(readFileSync(alignFile, 'utf8')) : null;
      // Con alineación no hace falta ffprobe: la voz termina con su última letra.
      const seconds = alignment
        ? alignment.character_end_times_seconds.at(-1) + 0.15
        : duration(`${dir}/${s.id}.${ext}`);
      const voiceFrames = Math.round(seconds * FPS);
      const tail = n === guion.escenas.length - 1 ? LAST_TAIL : TAIL;
      escenas.push({
        ...s,
        audio: `voz/${guion.tema}/${voice}/${s.id}.${ext}`,
        lead: LEAD,
        voiceFrames,
        frames: LEAD + voiceFrames + tail,
        chunks: chunks(s.texto, s.voz, alignment, seconds),
        words: words(s.voz, alignment, seconds),
      });
    }
    if (escenas.length !== guion.escenas.length) {
      console.log(
        `${guion.tema}/${voice}: faltan voces (${escenas.length}/${guion.escenas.length}), se omite`
      );
      continue;
    }
    const key = `${guion.tema}--${voice}`;
    const { escenas: _, ...meta } = guion;
    writeFileSync(`src/timings/${key}.json`, JSON.stringify({ ...meta, escenas }, null, 1));
    writeFileSync(`out/repaso-${guion.tema}-${voice}.vtt`, vtt(escenas));
    ready.push(key);
    const total = escenas.reduce((a, s) => a + s.frames, 0) / FPS;
    console.log(`${key}: ${total.toFixed(1)} s`);
  }
}

const lines = ready.map((k, i) => `import t${i} from './${k}.json';`);
lines.push('', 'export const TIMINGS = {', ...ready.map((k, i) => `  '${k}': t${i},`), '};', '');
writeFileSync('src/timings/index.ts', lines.join('\n'));
