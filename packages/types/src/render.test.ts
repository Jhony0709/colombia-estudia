/**
 * El render del Markdown de un tema.
 * SSOT: plan/07-contenido-y-migracion.md:12-18 (§1).
 *
 * Esto es la pieza de seguridad del contenido: todo lo que un estudiante ve del programa
 * pasa por aquí. La mitad de estas pruebas son de lo que NO debe salir.
 */

import { renderLessonHtml, type RenderAsset } from './render';

const IMAGE_ID = 'cm1abcdefghijklmnopqrstuv';
const VIDEO_ID = 'cm2abcdefghijklmnopqrstuv';
const PDF_ID = 'cm3abcdefghijklmnopqrstuv';

// Los mismos tres recursos, pero sin lo opcional. Cada campo que puede faltar tiene un
// camino de respaldo en el render, y un respaldo que nadie ejecuta no es un respaldo.
const AUDIO_ID = 'cm4abcdefghijklmnopqrstuv';
const AUDIO_SIN_ALT_ID = 'cm5abcdefghijklmnopqrstuv';
const VIDEO_SIN_TITULO_ID = 'cm6abcdefghijklmnopqrstuv';
const PDF_SIN_ALT_ID = 'cm7abcdefghijklmnopqrstuv';
const IMAGE_SIN_ALT_ID = 'cm8abcdefghijklmnopqrstuv';

const assets = new Map<string, RenderAsset>([
  [
    IMAGE_ID,
    {
      id: IMAGE_ID,
      kind: 'IMAGE',
      src: 'https://storage.test/firmada.png',
      altText: 'Alt guardado',
    },
  ],
  [
    VIDEO_ID,
    {
      id: VIDEO_ID,
      kind: 'VIDEO',
      src: 'https://player.vimeo.com/video/123',
      altText: null,
      title: 'Clase 1',
    },
  ],
  [
    PDF_ID,
    {
      id: PDF_ID,
      kind: 'DOCUMENT',
      src: 'https://storage.test/guia.pdf',
      altText: 'Guía de estudio',
    },
  ],
  [
    AUDIO_ID,
    {
      id: AUDIO_ID,
      kind: 'AUDIO',
      src: 'https://storage.test/clase.mp3',
      altText: 'Explicación en audio',
    },
  ],
  [
    AUDIO_SIN_ALT_ID,
    {
      id: AUDIO_SIN_ALT_ID,
      kind: 'AUDIO',
      src: 'https://storage.test/otra.mp3',
      altText: null,
    },
  ],
  [
    VIDEO_SIN_TITULO_ID,
    {
      id: VIDEO_SIN_TITULO_ID,
      kind: 'VIDEO',
      src: 'https://player.vimeo.com/video/456',
      altText: null,
    },
  ],
  [
    PDF_SIN_ALT_ID,
    {
      id: PDF_SIN_ALT_ID,
      kind: 'DOCUMENT',
      src: 'https://storage.test/anexo.pdf',
      altText: null,
    },
  ],
  [
    IMAGE_SIN_ALT_ID,
    {
      id: IMAGE_SIN_ALT_ID,
      kind: 'IMAGE',
      src: 'https://storage.test/sin-alt.png',
      altText: null,
    },
  ],
]);

const render = (markdown: string) => renderLessonHtml(markdown, assets);

describe('lo que NO sale', () => {
  it('un <script> escrito en el Markdown no llega a ser un <script>', () => {
    expect(render('<script>alert(1)</script>\n')).not.toContain('script');
  });

  it('un manejador de eventos no sobrevive', () => {
    expect(render('<img src=x onerror=alert(1)>\n')).not.toContain('onerror');
  });

  it('un <iframe> escrito a mano no apunta a donde quiera el autor', () => {
    expect(render('<iframe src="https://evil.test"></iframe>\n')).not.toContain('evil.test');
  });

  it.each(['javascript:alert(1)', 'data:text/html,x'])(
    'un enlace a %s se queda sin href',
    (url) => {
      const html = render(`[pincha](${url})\n`);

      expect(html).toContain('<a>');
      expect(html).not.toContain(url.split(':')[0] + ':');
    }
  );

  // El contrato solo admite `![alt](asset:<id>)`. Pintar una URL externa en la vista previa
  // pediría la imagen a un tercero desde el navegador de quien escribe.
  it('una imagen externa no se pide, y se dice qué hacer', () => {
    const html = render('![x](https://externo.test/a.png)\n');

    expect(html).not.toContain('externo.test');
    expect(html).toContain('biblioteca');
  });
});

describe('lo que sí sale', () => {
  it('una imagen por asset lleva su URL firmada', () => {
    expect(render(`![Diagrama](asset:${IMAGE_ID})\n`)).toContain('storage.test/firmada.png');
  });

  it('sin alt en el Markdown, usa el texto alternativo guardado del asset', () => {
    expect(render(`![](asset:${IMAGE_ID})\n`)).toContain('Alt guardado');
  });

  it('un video sale como figure con iframe y título', () => {
    const html = render(`::video{asset="${VIDEO_ID}"}\n`);

    expect(html).toContain('player.vimeo.com/video/123');
    expect(html).toContain('title="Clase 1"');
  });

  it('un PDF sale como enlace de descarga', () => {
    const html = render(`::pdf{asset="${PDF_ID}"}\n`);

    expect(html).toContain('storage.test/guia.pdf');
    expect(html).toContain('download');
  });

  it('las matemáticas salen en MathML, con su espacio de nombres', () => {
    expect(render('Una $x^2$ aquí.\n')).toContain(
      '<math xmlns="http://www.w3.org/1998/Math/MathML"'
    );
  });

  it('un bloque matemático conserva display="block"', () => {
    expect(render('$$\n\\frac{a}{b}\n$$\n')).toContain('display="block"');
  });

  it('la anotación LaTeX conserva su encoding, que es lo que la hace legible por lectores', () => {
    expect(render('$x^2$\n')).toContain('encoding="application/x-tex"');
  });

  it.each([':lang[software]{en}', ':lang[software]{lang=en}'])(
    'un fragmento en otro idioma sale con lang (%s)',
    (directive) => {
      expect(render(`Se dice ${directive} en inglés.\n`)).toContain('lang="en"');
    }
  );

  it('las tablas de GFM se mantienen', () => {
    expect(render('| a | b |\n| - | - |\n| 1 | 2 |\n')).toContain('<table>');
  });
});

describe('lo que falta', () => {
  it('un asset que no está se dice, no se deja un hueco', () => {
    const html = render(`::video{asset="cm9abcdefghijklmnopqrstuv"}\n`);

    expect(html).toContain('no está disponible');
    expect(html).toContain('role="note"');
  });

  // La validación impide publicar una directiva desconocida, pero la vista previa de un
  // borrador sí la ve: decir "recurso no disponible" sería mentir sobre qué pasa.
  it('una directiva desconocida se nombra en vez de hacerse pasar por un recurso ausente', () => {
    expect(render('::marquee{asset="x"}\n')).toContain('::marquee');
  });
});

// Cada `??` y cada ternario de `render.ts` es una decisión sobre qué ve un estudiante
// cuando al recurso le falta algo. Sin estas pruebas el audio entero no se ejecutaba nunca.
describe('cuando al recurso le falta lo opcional', () => {
  it('un audio sale como figure con controles', () => {
    const html = render(`::audio{asset="${AUDIO_ID}"}\n`);

    expect(html).toContain('class="media media-audio"');
    expect(html).toContain('storage.test/clase.mp3');
    expect(html).toContain('controls');
  });

  // El figcaption es la alternativa textual visible: si el asset la tiene, se pinta.
  it('un audio con texto alternativo lo pinta como figcaption', () => {
    expect(render(`::audio{asset="${AUDIO_ID}"}\n`)).toContain(
      '<figcaption>Explicación en audio</figcaption>'
    );
  });

  // Y si no la tiene no se inventa un figcaption vacío, que un lector de pantalla anunciaría
  // como un pie de figura sin contenido.
  it('un audio sin texto alternativo no lleva figcaption', () => {
    expect(render(`::audio{asset="${AUDIO_SIN_ALT_ID}"}\n`)).not.toContain('figcaption');
  });

  // Un iframe sin `title` es un fallo de WCAG 4.1.2, así que el respaldo no es opcional.
  it('un video sin título usa uno genérico en vez de quedarse sin title', () => {
    expect(render(`::video{asset="${VIDEO_SIN_TITULO_ID}"}\n`)).toContain('title="Video del tema"');
  });

  it('un PDF sin texto alternativo usa el texto de enlace genérico', () => {
    expect(render(`::pdf{asset="${PDF_SIN_ALT_ID}"}\n`)).toContain('Descargar el documento');
  });

  it('una directiva sin atributo asset cae en "no está disponible", no en una excepción', () => {
    expect(render('::video\n')).toContain('no está disponible');
  });

  it('una imagen que cita un asset que no existe lo dice en el alt', () => {
    const html = render('![Diagrama](asset:cm9abcdefghijklmnopqrstuv)\n');

    expect(html).toContain('alt="Imagen no disponible"');
    expect(html).toContain('src=""');
  });

  // Alt vacío = imagen decorativa. Es la lectura correcta cuando no hay nada que decir:
  // inventar un alt sería peor que no tenerlo.
  it('sin alt y con un asset sin texto alternativo, el alt queda vacío', () => {
    expect(render(`![](asset:${IMAGE_SIN_ALT_ID})\n`)).toContain('alt=""');
  });
});

describe(':lang sin un idioma que declarar', () => {
  // `:lang[texto]` a secas y `:lang[texto]{foo=bar}` no traen código de idioma. El span sale
  // igual —el texto no se pierde— pero sin un `lang` inventado, que le mentiría al lector
  // de pantalla sobre cómo pronunciarlo.
  it.each([':lang[hello]', ':lang[hello]{foo=bar}'])('%s sale sin atributo lang', (directiva) => {
    const html = render(`${directiva}\n`);

    expect(html).toContain('<span>hello</span>');
    expect(html).not.toContain('lang=');
  });
});

describe('contenedor', () => {
  it('con idioma envuelve el contenido y lo declara', () => {
    expect(renderLessonHtml('Texto.\n', assets, { language: 'es-CO' })).toContain(
      '<div lang="es-CO">'
    );
  });

  it('sin idioma no envuelve nada', () => {
    expect(renderLessonHtml('Texto.\n', assets)).not.toContain('<div');
  });
});
