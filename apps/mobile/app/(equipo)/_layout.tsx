import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@fluxus-ui/native';
import { copy } from '../../src/copy';
import { homeOf } from '../../src/roles';
import { useSession } from '../../src/SessionProvider';

const t = copy.tabs;

/** Las pestañas del equipo (reference/03-ui/movil.md, «Navegación»). */
export default function StaffTabs() {
  const theme = useTheme();
  const { state } = useSession();
  if (state.kind !== 'in' || homeOf(state.me) !== '/mensajes') return <Redirect href="/" />;
  return (
    <NativeTabs tintColor={theme.color['text.accent']}>
      <NativeTabs.Trigger name="mensajes">
        <NativeTabs.Trigger.Label>{t.messages}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="forum" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="solicitudes">
        <NativeTabs.Trigger.Label>{t.requests}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="tray" md="inbox" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuenta">
        <NativeTabs.Trigger.Label>{t.staffAccount}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
