'use client';

/**
 * «Responder» a un mensaje concreto (22/11): el hilo marca cuál y el formulario lo envía como
 * cita. Solo vive en el cliente; el hilo lo sigue pintando el servidor.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Reply } from 'lucide-react';

export interface ReplyTarget {
  id: string;
  body: string;
  author: string;
}

const Ctx = createContext<{
  target: ReplyTarget | null;
  setTarget: (target: ReplyTarget | null) => void;
} | null>(null);

export function ReplyTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  return <Ctx.Provider value={{ target, setTarget }}>{children}</Ctx.Provider>;
}

export function useReplyTarget() {
  return useContext(Ctx) ?? { target: null, setTarget: () => undefined };
}

export function QuoteButton(target: ReplyTarget) {
  const t = useTranslations('messaging.actions');
  const { setTarget } = useReplyTarget();
  return (
    <button
      type="button"
      onClick={() => {
        setTarget(target);
        document.getElementById('chat-reply')?.focus();
      }}
      className="type-caption text-text-link inline-flex items-center gap-1 underline-offset-4 hover:underline"
    >
      <Reply aria-hidden className="size-3.5 shrink-0" />
      {t('quote')}
    </button>
  );
}
