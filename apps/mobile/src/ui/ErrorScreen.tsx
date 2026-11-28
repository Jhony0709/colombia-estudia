import { useEffect } from 'react';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Button, EmptyState, ThemeProvider } from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { report } from '../monitoring';
import { theme } from '../../theme/alba';

/** Lo que una ruta enseña si su pantalla falla al pintarse; trae su tema porque la raíz puede ser la que falló. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => report(error), [error]);
  // Si falló la raíz, nadie más quita la pantalla de arranque.
  useEffect(() => SplashScreen.hide(), []);
  return (
    <ThemeProvider theme={theme}>
      <Screen>
        <EmptyState
          title={copy.crashTitle}
          action={
            <Button variant="primary" onPress={retry}>
              {copy.retry}
            </Button>
          }
        >
          {copy.crashBody}
        </EmptyState>
      </Screen>
    </ThemeProvider>
  );
}
