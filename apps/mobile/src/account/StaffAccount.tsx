import { Button, Card, Text } from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { PushCard } from '../push/PushCard';
import { useSession } from '../SessionProvider';
import { WebLink } from '../ui/WebLink';

/** La pestaña «Cuenta» del equipo: quién entró, los avisos y salir. */
export function StaffAccount() {
  const { state, signOut } = useSession();
  const me = state.kind === 'in' ? state.me : null;
  return (
    <Screen scroll>
      <Text variant="heading">{copy.staffAccount.title}</Text>
      {me && (
        <Card>
          <Text weight="medium">{`${me.person.givenName} ${me.person.familyName}`}</Text>
        </Card>
      )}
      <PushCard />
      <WebLink>{copy.staffAccount.onWeb}</WebLink>
      <Button variant="secondary" onPress={signOut}>
        {copy.signOut}
      </Button>
    </Screen>
  );
}
