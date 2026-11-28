import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@fluxus-ui/native';
import { copy } from '../../src/copy';
import { useUnread } from '../../src/notifications/unread';
import { homeOf } from '../../src/roles';
import { useSession } from '../../src/SessionProvider';

const t = copy.tabs;

/** Las pestañas del estudiante (reference/03-ui/movil.md, «Navegación»). */
export default function StudentTabs() {
  const theme = useTheme();
  const { state } = useSession();
  const unread = useUnread();
  if (state.kind !== 'in' || homeOf(state.me) !== '/aprender') return <Redirect href="/" />;
  return (
    <NativeTabs tintColor={theme.color['text.accent']}>
      <NativeTabs.Trigger name="(ruta)">
        <NativeTabs.Trigger.Label>{t.route}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map" md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notificaciones">
        <NativeTabs.Trigger.Label>{t.notifications}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell" md="notifications" />
        <NativeTabs.Trigger.Badge hidden={unread === 0}>{String(unread)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendario">
        <NativeTabs.Trigger.Label>{t.calendar}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mi-cuenta">
        <NativeTabs.Trigger.Label>{t.account}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard" md="account_balance_wallet" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
