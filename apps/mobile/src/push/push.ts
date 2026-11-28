import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { request } from '../api';
import { copy } from '../copy';

// Con la app abierta el aviso también se ve; el chat que se tiene a la vista no avisa (lo calla el servidor).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** `on`: registrado. `ask`: se puede pedir el permiso. `off`: lo negó, o este teléfono no puede. */
export type PushState = 'on' | 'ask' | 'off';

/** El token con que este teléfono quedó registrado, para borrarlo al cerrar sesión. */
let registered: string | null = null;

/** Android no pregunta por el permiso sin un canal, y el servidor manda cada aviso a uno de estos. */
async function channels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const [id, name] of Object.entries(copy.push.channels)) {
    await Notifications.setNotificationChannelAsync(id, {
      name,
      importance: AndroidImportance.HIGH,
    });
  }
}

async function register(): Promise<void> {
  const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await request<unknown>('/api/push/devices', {
    method: 'PUT',
    body: { token, platform: Platform.OS },
  });
  registered = token;
}

/** Al entrar: con permiso, registra el teléfono; sin él, dice si se puede pedir. No pregunta nada. */
export async function syncPush(): Promise<PushState> {
  await channels();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? 'ask' : 'off';
  await register();
  return 'on';
}

/** «Activar avisos»: el diálogo del sistema y, con permiso, el registro. */
export async function enablePush(): Promise<PushState> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'off';
  await register();
  return 'on';
}

/**
 * Antes de cerrar sesión, con ella aún viva: el servidor olvida el teléfono. Y el teléfono se da
 * de baja del push siempre, haya red o no y se llegara a registrar o no: sin sesión no puede
 * seguir enseñando nombres de contactos.
 */
export async function forgetPush(): Promise<void> {
  const token = registered;
  registered = null;
  if (token) {
    await request<unknown>('/api/push/devices', { method: 'DELETE', body: { token } }).catch(
      () => undefined
    );
  }
  await Notifications.unregisterForNotificationsAsync().catch(() => undefined);
}
