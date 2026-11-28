import * as Sentry from '@sentry/react-native';
import { ApiError } from './api';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** El reporte de caídas (reference/03-ui/movil.md, «Producción»). Sin DSN o en desarrollo no envía nada. */
export function startMonitoring(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    enabled: !__DEV__,
    // Sin datos personales: ni quién es, ni su IP, ni la sesión grabada.
    sendDefaultPii: false,
    // Un fallo de red o del servidor no es una caída, y su mensaje puede traer un nombre.
    beforeSend: (event, hint) => (hint.originalException instanceof ApiError ? null : event),
  });
}

export function report(error: unknown): void {
  if (dsn) Sentry.captureException(error);
}
