import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Button, EmptyState } from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { useSession } from '../SessionProvider';

/** Al abrir sin red: la sesión guardada se conserva y se vuelve a comprobar (reference/03-ui/movil.md, M0). */
export function Offline() {
  const { retry } = useSession();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (now) => {
      if (now === 'active') void retry();
    });
    return () => subscription.remove();
  }, [retry]);
  return (
    <Screen>
      <EmptyState
        title={copy.offlineTitle}
        action={
          <Button variant="primary" onPress={retry}>
            {copy.retry}
          </Button>
        }
      >
        {copy.offlineBody}
      </EmptyState>
    </Screen>
  );
}
