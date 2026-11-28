import { useEffect, type ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, ToastProvider, useTheme, type Fonts } from '@fluxus-ui/native';
import { enableHaptics } from '@fluxus-ui/native/haptics';
import { AccessScreen } from '../src/AccessScreen';
import { copy } from '../src/copy';
import { startMonitoring } from '../src/monitoring';
import { SessionProvider, useSession } from '../src/SessionProvider';
import { PushTaps } from '../src/push/PushTaps';
import { BrowserNotice } from '../src/ui/browser';
import { Loading } from '../src/ui/Loading';
import { Offline } from '../src/ui/Offline';
import { theme } from '../theme/alba';

export { ErrorBoundary } from '../src/ui/ErrorScreen';

startMonitoring();
// La pantalla de arranque espera a la letra: sin pantalla en blanco entre las dos.
void SplashScreen.preventAutoHideAsync();

const FONTS: Required<Fonts> = {
  regular: 'AtkinsonHyperlegibleNext-Regular',
  medium: 'AtkinsonHyperlegibleNext-SemiBold',
  bold: 'AtkinsonHyperlegibleNext-Bold',
};

/** Sin sesión, la pantalla de acceso; con ella, las rutas de `app/`. */
function Gate() {
  const { state } = useSession();
  useEffect(() => SplashScreen.hide(), []);
  if (state.kind === 'checking') return <Loading />;
  if (state.kind === 'offline') return <Offline />;
  if (state.kind !== 'in') return <AccessScreen />;
  return (
    <>
      <PushTaps />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

/** Los avisos sueltos de la app, por encima de la barra del sistema. */
function Notices({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <ToastProvider inset={bottom + theme.size['space.4']} dismissLabel={copy.dismiss}>
      <BrowserNotice />
      {children}
    </ToastProvider>
  );
}

export default function RootLayout() {
  useEffect(() => enableHaptics(), []);
  const [loaded, error] = useFonts({
    [FONTS.regular]: require('../assets/fonts/AtkinsonHyperlegibleNext-Regular.ttf'),
    [FONTS.medium]: require('../assets/fonts/AtkinsonHyperlegibleNext-SemiBold.ttf'),
    [FONTS.bold]: require('../assets/fonts/AtkinsonHyperlegibleNext-Bold.ttf'),
  });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      {/* Si la letra no carga, la del sistema: mejor que una pantalla en blanco. */}
      <ThemeProvider theme={theme} fonts={loaded ? FONTS : undefined}>
        <StatusBar style="auto" />
        <Notices>
          <SessionProvider>
            <Gate />
          </SessionProvider>
        </Notices>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
