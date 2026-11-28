import { Text } from 'react-native';

jest.unmock('expo-router');

// Con el módulo real: dónde cae cada dirección de la app.
const { Stack, router } = jest.requireActual('expo-router');
const { act, renderRouter } = jest.requireActual('expo-router/testing-library');

describe('routes', () => {
  it('opens a chat above the tabs, at the same address as on the web', async () => {
    const app = await renderRouter(
      {
        _layout: () => <Stack />,
        '(equipo)/_layout': () => <Stack />,
        '(equipo)/mensajes/index': () => <Text>bandeja</Text>,
        '(chat)/_layout': () => <Stack />,
        '(chat)/mensajes/[id]': () => <Text>chat</Text>,
      },
      { initialUrl: '/mensajes' }
    );
    expect(app.getByText('bandeja')).toBeTruthy();
    await act(() => router.push('/mensajes/c-1'));
    expect(app.getByText('chat')).toBeTruthy();
    expect(app.getSegments()).toEqual(['(chat)', 'mensajes', '[id]']);
    await act(() => router.back());
    expect(app.getByText('bandeja')).toBeTruthy();
  });
});
