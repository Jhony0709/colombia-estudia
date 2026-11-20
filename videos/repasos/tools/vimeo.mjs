// Sube cada repaso a Vimeo con su .vtt en español y guarda los ids en vimeo.json.
// Uso: VIMEO_TOKEN=… node tools/vimeo.mjs [tema …]   (token con scopes upload, edit, private)
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { temas } from './temas.mjs';

const API = 'https://api.vimeo.com';
const ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';
const VOICE = 'JcWDFG8DiES2OzGhZJUJ';
const DOMAIN = 'albafuturoeducativo.com';
const LOG = 'vimeo.json';

const token = process.env.VIMEO_TOKEN;
if (!token) {
  console.error('Falta VIMEO_TOKEN en el entorno.');
  process.exit(1);
}
const done = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};

async function vimeo(path, { method = 'GET', body } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ACCEPT,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

for (const guion of temas(process.argv.slice(2))) {
  const { tema, titulo } = guion;
  const mp4 = `out/repaso-${tema}.mp4`;
  const vtt = `out/repaso-${tema}-${VOICE}.vtt`;
  if (done[tema]) continue;
  if (!existsSync(mp4) || !existsSync(vtt)) {
    console.error(`${tema}: falta ${existsSync(mp4) ? vtt : mp4}`);
    continue;
  }

  const video = await vimeo('/me/videos', {
    method: 'POST',
    body: {
      upload: { approach: 'tus', size: statSync(mp4).size },
      name: `Repaso: ${titulo}`,
      privacy: { view: 'disable', embed: 'whitelist', download: false },
    },
  });
  const id = video.uri.split('/').pop();

  const up = await fetch(video.upload.upload_link, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': '0',
      'Content-Type': 'application/offset+octet-stream',
    },
    body: readFileSync(mp4),
  });
  if (!up.ok) throw new Error(`${tema}: subida ${up.status}`);

  await vimeo(`/videos/${id}/privacy/domains/${DOMAIN}`, { method: 'PUT' });

  const track = await vimeo(`/videos/${id}/texttracks`, {
    method: 'POST',
    body: { type: 'captions', language: 'es', name: 'Español' },
  });
  const put = await fetch(track.link, { method: 'PUT', body: readFileSync(vtt) });
  if (!put.ok) throw new Error(`${tema}: subtítulos ${put.status}`);
  await vimeo(track.uri, { method: 'PATCH', body: { active: true } });

  done[tema] = { id, url: `https://vimeo.com/${id}`, titulo };
  writeFileSync(LOG, JSON.stringify(done, null, 2) + '\n');
  console.log(`${tema} → ${id}`);
}
