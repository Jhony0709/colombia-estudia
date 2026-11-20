// Genera con la API de OpenAI la base de las imágenes del contenido: el dibujo, sin ningún texto.
// Los rótulos se ponen después encima, en SVG con la tipografía de la marca: así salen exactos.
// El estilo común está en `estilo.json`; cada componente tiene su `encargos.json`. No imprime la llave.
// Uso (desde la raíz del repo):
//   node packages/scripts/imagenes/generar.mjs <encargos.json>… [--solo id,id] [--variantes 2] [--force]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.openai.com/v1/images/generations';
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const files = args.filter((a) => a.endsWith('.json'));
const force = args.includes('--force');
const variants = Number(flag('--variantes')) || 1;
const only = flag('--solo')?.split(',') ?? [];

const key = process.env.OPENAI_API_KEY;
if (!key || files.length === 0) {
  console.error(
    'Uso: OPENAI_API_KEY=… node packages/scripts/imagenes/generar.mjs <encargos.json>…'
  );
  process.exit(1);
}

const common = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'estilo.json'), 'utf8')
);
const model = process.env.OPENAI_IMAGE_MODEL || common.modelo;

/** Ya hay una base para `id` (`id.webp` o una variante `id-N.webp`). */
const done = (dir, id) =>
  existsSync(dir) && readdirSync(dir).some((f) => new RegExp(`^${id}(-\\d+)?\\.webp$`).test(f));

let failed = 0;
for (const file of files) {
  const outDir = join(dirname(file), 'base');
  mkdirSync(outDir, { recursive: true });
  const { encargos } = JSON.parse(readFileSync(file, 'utf8'));
  for (const item of encargos.filter((e) => only.length === 0 || only.includes(e.id))) {
    if (!force && done(outDir, item.id)) {
      console.log(`${item.id}: ya tiene base, se omite (--force para repetir)`);
      continue;
    }
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: [common.estilo, item.prompt, common.reglas].join('\n\n'),
        size: item.size || common.size,
        quality: item.quality || common.quality,
        output_format: 'webp',
        output_compression: 90,
        n: variants,
      }),
      signal: AbortSignal.timeout(300_000),
    }).catch((error) => ({ ok: false, status: 0, json: async () => ({ error }) }));
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      failed++;
      console.error(`${item.id}: error ${res.status} ${body.error?.message ?? ''}`);
      continue;
    }
    body.data.forEach((d, i) => {
      const name = variants > 1 ? `${item.id}-${i + 1}.webp` : `${item.id}.webp`;
      writeFileSync(join(outDir, name), Buffer.from(d.b64_json, 'base64'));
    });
    console.log(`${item.id}: ${body.data.length} imagen(es) en ${outDir}`);
  }
}
process.exit(failed ? 1 : 0);
