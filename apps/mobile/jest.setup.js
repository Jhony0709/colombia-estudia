require('react-native-reanimated').setUpTests();

// Keychain y Keystore no existen en Jest: un almacén en memoria.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key) => void store.delete(key)),
  };
});

// expo-router sin navegador: lo que usan las pantallas.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect) => useEffect(effect, [effect]),
    Redirect: () => null,
    Stack: () => null,
  };
});

// Sin audio nativo: un reproductor que se puede inspeccionar.
jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => undefined) };
  return {
    player,
    useAudioPlayer: jest.fn(() => player),
    useAudioPlayerStatus: jest.fn(() => ({
      playing: false,
      currentTime: 0,
      duration: 0,
      didJustFinish: false,
    })),
  };
});

// Sin servicio de push: con permiso y un token fijo; cada prueba cambia lo que necesita.
jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  AndroidImportance: { HIGH: 6 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  unregisterForNotificationsAsync: jest.fn(async () => undefined),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

// El navegador de la app: se comprueba qué abre.
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
}));

// La WebView como una vista que guarda sus props: las pruebas mandan sus mensajes.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: (props) => require('react').createElement(View, props) };
});
