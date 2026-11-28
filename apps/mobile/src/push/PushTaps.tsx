import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { follow } from '../links';
import { markRead } from '../notifications/api';

/** Tocar un aviso lleva a su `href` (también si la app estaba cerrada) y lo deja leído en la campana. */
export function PushTaps() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { href, notificationId } = response.notification.request.content.data ?? {};
    if (typeof notificationId === 'string') void markRead(notificationId).catch(() => undefined);
    if (typeof href === 'string') void Promise.resolve(follow(href)).catch(() => undefined);
    // Una vez: al volver a montar no se repite.
    void Notifications.clearLastNotificationResponseAsync();
  }, [response]);
  return null;
}
