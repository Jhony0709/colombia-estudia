import { Redirect } from 'expo-router';
import { homeOf } from '../src/roles';
import { useSession } from '../src/SessionProvider';

export default function Index() {
  const { state } = useSession();
  const home = state.kind === 'in' ? homeOf(state.me) : null;
  return home ? <Redirect href={home} /> : null;
}
