import type { Theme } from '@fluxus-ui/native';
import type { theme as alba } from '../../theme/alba';

/**
 * La página de la WebView: el HTML saneado del servidor, el CSS de los tokens y un script que
 * manda su alto y lo que reporta el player de Vimeo (como evidence-recorder.tsx:180-243).
 */
const SCRIPT = `(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var height = function () { post({ type: 'height', value: Math.ceil(document.documentElement.scrollHeight) }); };
  if (window.ResizeObserver) new ResizeObserver(height).observe(document.body);
  window.addEventListener('load', height);
  height();
  var ORIGIN = 'https://player.vimeo.com';
  var frames = [].slice.call(document.querySelectorAll('.media-video iframe'));
  var subscribe = function (f) {
    if (!f.contentWindow) return;
    ['playProgress', 'timeupdate'].forEach(function (value) {
      f.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: value }), ORIGIN);
    });
    f.contentWindow.postMessage(JSON.stringify({ method: 'getDuration' }), ORIGIN);
  };
  window.addEventListener('message', function (event) {
    if (event.origin !== ORIGIN) return;
    var m;
    try { m = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if (!m) return;
    if (m.event === 'ready') { frames.forEach(subscribe); return; }
    if (m.method === 'getDuration') {
      var d = typeof m.value === 'number' ? m.value : m.data;
      if (typeof d === 'number') post({ type: 'video', seconds: 0, duration: d });
      return;
    }
    if ((m.event === 'timeupdate' || m.event === 'playProgress') && m.data) {
      post({ type: 'video', seconds: m.data.seconds || 0, duration: m.data.duration || 0 });
    }
  });
  frames.forEach(function (f) { f.addEventListener('load', function () { subscribe(f); }); subscribe(f); });
})();`;

export function lessonDocument(html: string, theme: Theme<typeof alba>, scale: number): string {
  const c = theme.color;
  const size = 16 * scale;
  const css = `
    :root { color-scheme: ${theme.mode}; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { padding: 0 ${theme.size['layout.gutter']}px; color: ${c['text.default']};
      font: ${size}px/1.6 -apple-system, system-ui, Roboto, sans-serif; overflow-wrap: anywhere; }
    a { color: ${c['text.accent']}; }
    h1, h2, h3, h4 { line-height: 1.25; }
    img, video { max-width: 100%; height: auto; }
    iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; }
    table { display: block; overflow-x: auto; border-collapse: collapse; }
    th, td { border: 1px solid ${c['border.default']}; padding: 4px 8px; }
    pre, code { background: ${c['surface.sunken']}; border-radius: 4px; }
    pre { padding: 12px; overflow-x: auto; }
    blockquote, aside { margin: 1em 0; padding: 12px 16px; background: ${c['app.surface.note']}; border-radius: 8px; }
    math { font-size: 1.1em; }
  `;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><article>${html}</article><script>${SCRIPT}</script></body></html>`;
}
