'use client';

/**
 * Mantiene la bandeja al día sin tiempo real: cada `seconds`, mientras está visible, pregunta
 * por la huella (`/api/conversations/pulse`) y solo vuelve a pedir la página si cambió (19/11;
 * hasta entonces la pedía entera cada vez).
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({
  stamp,
  conversationId,
  seconds = 10,
}: {
  /** La huella con la que el servidor pintó la página. */
  stamp: string;
  conversationId?: string;
  seconds?: number;
}) {
  const router = useRouter();
  const seen = useRef(stamp);
  useEffect(() => {
    seen.current = stamp;
  }, [stamp]);
  useEffect(() => {
    const url = `/api/conversations/pulse${conversationId ? `?id=${conversationId}` : ''}`;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: { data?: { stamp?: string } } | null) => {
          const next = payload?.data?.stamp;
          if (next === undefined || next === seen.current) return;
          seen.current = next;
          router.refresh();
        })
        .catch(() => undefined);
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds, conversationId]);
  return null;
}
