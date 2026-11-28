import { router } from 'expo-router';
import { openBrowser } from './ui/browser';
import { openWeb } from './ui/WebLink';

// Las rutas de la web que la app ya tiene; se añaden con cada pantalla de M2.
const IN_APP: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/aprender\/?$/, () => '/aprender'],
  [/^\/aprender\/tema\/([^/?#]+)$/, (m) => `/aprender/tema/${m[1]}`],
  [/^\/aprender\/notificaciones\/?$/, () => '/aprender/notificaciones'],
  [/^\/aprender\/mi-cuenta\/?$/, () => '/aprender/mi-cuenta'],
  [/^\/aprender\/calendario\/?$/, () => '/aprender/calendario'],
  [/^\/aprender\/certificados\/?$/, () => '/aprender/certificados'],
  [/^\/mensajes\/([^/?#]+)$/, (m) => `/mensajes/${m[1]}`],
  [/^\/solicitudes\/?$/, () => '/solicitudes'],
];

/** Un `href` del servidor: en la app si la tiene, si no en el navegador de la app. */
export function follow(href: string): void | Promise<unknown> {
  if (/^https?:\/\//.test(href)) return openBrowser(href);
  for (const [pattern, to] of IN_APP) {
    const match = href.match(pattern);
    if (match) return router.push(to(match));
  }
  return openWeb(href);
}
