// Copia las ilustraciones del contenido (packages/scripts/seed/contenido/imagenes/<componente>/*.webp)
// a public/imagenes/, de donde las toma la escena `imagen`. No se versionan aquí: la fuente es aquella.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const SRC = '../../packages/scripts/seed/contenido/imagenes';
if (!existsSync(SRC)) process.exit(0);
let n = 0;
for (const comp of readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  mkdirSync(`public/imagenes/${comp.name}`, { recursive: true });
  for (const f of readdirSync(`${SRC}/${comp.name}`).filter((f) => f.endsWith('.webp'))) {
    cpSync(`${SRC}/${comp.name}/${f}`, `public/imagenes/${comp.name}/${f}`);
    n++;
  }
}
console.log(`${n} imágenes en public/imagenes/`);
