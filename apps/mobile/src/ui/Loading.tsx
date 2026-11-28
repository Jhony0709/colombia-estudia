import { View } from 'react-native';
import { Spinner } from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';

/** Mientras se sabe si hay sesión: el lector oye «Cargando». */
export function Loading() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Spinner label={copy.loading} />
      </View>
    </Screen>
  );
}
