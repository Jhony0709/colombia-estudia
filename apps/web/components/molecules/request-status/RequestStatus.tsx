'use client';

/**
 * RequestStatus: lo que la persona ve mientras una petición tarda o cuando falla (E1,
 * 23/9). Va junto al botón que la disparó, con `role="status"` para que un lector de
 * pantalla lo oiga sin robar el foco.
 *
 * Tres frases y ninguna más: «Enviando…» lo dice el botón; esto entra cuando la espera es
 * larga («Está tardando más de lo normal. No cierres esta pantalla: lo que escribiste sigue
 * aquí.») y cuando falló («No pudimos confirmarlo. Lo que escribiste sigue aquí.» +
 * Reintentar). No dice «error de red» ni códigos: la persona no puede hacer nada con eso.
 */

import { useTranslations } from 'next-intl';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import type { RequestPhase } from '@/lib/net/slow-request';

export function RequestStatus({
  phase,
  elapsedSeconds,
  onRetry,
  /** Qué se conserva, en palabras («lo que escribiste», «tus respuestas»). */
  kept,
}: {
  phase: RequestPhase;
  elapsedSeconds: number;
  onRetry: () => void;
  kept: 'text' | 'answers' | 'nothing';
}) {
  const t = useTranslations('net');
  if (phase === 'idle' || phase === 'busy') {
    // `busy` no pinta nada: el botón ya lo dice. Pero el `status` existe siempre, para que
    // cuando cambie el texto el lector de pantalla lo anuncie.
    return <p role="status" className="sr-only" />;
  }

  return (
    <div
      role="status"
      className="bg-status-warning-muted text-text rounded-control type-body flex flex-wrap items-center gap-3 px-3 py-2"
    >
      {phase === 'slow' ? (
        <>
          <Loader2 aria-hidden className="text-status-warning-base size-4 shrink-0 animate-spin" />
          <span className="flex-1">
            {t('slow', { seconds: elapsedSeconds })} {t(`kept.${kept}`)}
          </span>
        </>
      ) : (
        <>
          <span className="flex-1">
            {t('failed')} {t(`kept.${kept}`)}
          </span>
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RotateCcw aria-hidden className="size-4" />
            {t('retry')}
          </Button>
        </>
      )}
    </div>
  );
}
