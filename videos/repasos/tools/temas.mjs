// Los guiones: temas/<componente>/<tema>.json. `filtro` (claves de tema) limita la lista.
import { readdirSync, readFileSync } from 'node:fs';

export function temas(filtro = []) {
  const out = [];
  for (const comp of readdirSync('temas', { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const file of readdirSync(`temas/${comp.name}`).filter((f) => f.endsWith('.json'))) {
      const guion = JSON.parse(readFileSync(`temas/${comp.name}/${file}`, 'utf8'));
      if (!filtro.length || filtro.includes(guion.tema)) out.push(guion);
    }
  }
  return out;
}
