import * as SecureStore from 'expo-secure-store';

/** La forma de `POST /api/auth/token` y `/api/auth/refresh` (reference/02-api/endpoints.md). */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Segundos desde 1970. */
  expiresAt: number;
}

// Solo el refreshToken queda en el teléfono; el accessToken vive en memoria y se renueva al abrir.
const KEY = 'alba.refreshToken';

export const loadRefreshToken = () => SecureStore.getItemAsync(KEY);
export const saveRefreshToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const clearRefreshToken = () => SecureStore.deleteItemAsync(KEY);
