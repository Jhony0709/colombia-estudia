import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { follow } from '../src/links';

afterEach(() => jest.clearAllMocks());

describe('follow', () => {
  it.each([
    ['/aprender', '/aprender'],
    ['/aprender/tema/a-1', '/aprender/tema/a-1'],
    ['/aprender/notificaciones', '/aprender/notificaciones'],
    ['/aprender/mi-cuenta', '/aprender/mi-cuenta'],
    ['/aprender/calendario', '/aprender/calendario'],
    ['/aprender/certificados', '/aprender/certificados'],
    ['/mensajes/c-1', '/mensajes/c-1'],
    ['/solicitudes', '/solicitudes'],
  ])('opens %s in the app', async (href, to) => {
    await follow(href);
    expect(router.push).toHaveBeenCalledWith(to);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['/aprender/examen/x-1', 'https://albafuturoeducativo.com/aprender/examen/x-1'],
    ['/aprender/tema/a-1?pago=1', 'https://albafuturoeducativo.com/aprender/tema/a-1?pago=1'],
    ['https://vimeo.com/1', 'https://vimeo.com/1'],
  ])('opens %s on the web', async (href, url) => {
    await follow(href);
    expect(openBrowserAsync).toHaveBeenCalledWith(url);
    expect(router.push).not.toHaveBeenCalled();
  });
});
