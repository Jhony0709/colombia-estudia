'use client';

/**
 * Vuelve a pedir la página cada `seconds` mientras está visible (5/11): la bandeja ve los chats
 * nuevos sin recargar a mano. Sin tiempo real: con pocos chats, un refresco basta.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
