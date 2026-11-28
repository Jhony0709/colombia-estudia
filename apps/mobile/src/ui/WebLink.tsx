import { Link } from '@fluxus-ui/native';
import { API_URL } from '../api';
import { openBrowser } from './browser';

/** Una ruta de la web en el navegador de la app; la promesa acaba al cerrarlo (en iOS). */
export const openWeb = (path: string) => openBrowser(`${API_URL}${path}`);

/** «Hazlo en la web» y compañía. */
export function WebLink({ path = '', children }: { path?: string; children: string }) {
  return <Link onPress={() => openWeb(path)}>{children}</Link>;
}
