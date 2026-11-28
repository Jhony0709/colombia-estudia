import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Button, Card, Message, Stack, Text } from '@fluxus-ui/native';
import { copy } from '../copy';
import { enablePush, syncPush, type PushState } from './push';

const t = copy.push;

/** El permiso de los avisos se pide aquí, en contexto y con un botón, no al abrir la app. */
export function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // Sin proyecto de Expo o sin red no hay token: la bandeja sigue igual, sin avisos.
    const sync = () =>
      syncPush().then(
        (next) => live && setState(next),
        () => undefined
      );
    void sync();
    // El sistema puede cambiar el token con la app abierta.
    const changed = Notifications.addPushTokenListener(() => void sync());
    return () => {
      live = false;
      changed.remove();
    };
  }, []);

  if (state !== 'ask') return null;
  const enable = async () => {
    setFailed(false);
    try {
      setState(await enablePush());
    } catch (error) {
      setFailed(true);
      throw error;
    }
  };
  return (
    <Card>
      <Stack gap="2">
        <Text weight="medium">{t.title}</Text>
        <Text tone="muted">{t.body}</Text>
        <Button variant="primary" onPress={enable}>
          {t.enable}
        </Button>
        {failed && <Message tone="danger">{t.failed}</Message>}
      </Stack>
    </Card>
  );
}
