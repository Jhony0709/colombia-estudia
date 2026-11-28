import type { ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, ToastProvider, useTheme, type Fonts } from '@fluxus-ui/native';
import { AccessScreen } from '../src/AccessScreen';
import { copy } from '../src/copy';
import { SessionProvider, useSession } from '../src/SessionProvider';
import { PushTaps } from '../src/push/PushTaps';
import { BrowserNotice } from '../src/ui/browser';
import { Loading } from '../src/ui/Loading';
import { theme } from '../theme/alba';

const FONTS: Required<Fonts> = {
  regular: 'AtkinsonHyperlegibleNext-Regular',
  medium: 'AtkinsonHyperlegibleNext-SemiBold',
  bold: 'AtkinsonHyperlegibleNext-Bold',
};

/** Sin sesión, la pantalla de acceso; con ella, las rutas de `app/`. */
function Gate() {
  const { state } = useSession();
  if (state.kind === 'checking') return <Loading />;
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
