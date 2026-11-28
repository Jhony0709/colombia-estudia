import { Redirect, Stack } from 'expo-router';
import { homeOf } from '../../src/roles';
import { useSession } from '../../src/SessionProvider';

/** El chat se abre encima de las pestañas, como en WhatsApp: sin barra abajo y con el campo sobre el teclado. */
export default function ChatLayout() {
  const { state } = useSession();
  if (state.kind !== 'in' || homeOf(state.me) !== '/mensajes') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export { ErrorBoundary } from '../../src/ui/ErrorScreen';
