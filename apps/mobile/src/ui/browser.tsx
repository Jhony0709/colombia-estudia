import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useToast } from '@fluxus-ui/native';
import { copy } from '../copy';

let tell: (() => void) | null = null;

/** Una dirección web en el navegador de la app; `mailto:` y `tel:`, al sistema. Si no abre, lo dice el aviso. */
export async function openBrowser(url: string): Promise<unknown> {
  try {
    return await (/^https?:\/\//.test(url)
      ? WebBrowser.openBrowserAsync(url)
      : Linking.openURL(url));
  } catch (error) {
    tell?.();
    throw error;
  }
}

/** Una vez, bajo `ToastProvider`: quien pulsó no tiene que contar el fallo. */
export function BrowserNotice() {
  const toast = useToast();
  useEffect(() => {
    tell = () => toast({ title: copy.webFailed, tone: 'danger' });
    return () => {
      tell = null;
    };
  }, [toast]);
  return null;
}
