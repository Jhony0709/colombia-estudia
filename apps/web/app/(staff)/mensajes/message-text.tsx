/**
 * El texto de un mensaje como lo ve la persona en su canal (22/11): en WhatsApp, con su
 * formato; en texto plano, tal cual. Sin hooks: lo usan el hilo y la vista previa.
 */

import type { ReactNode } from 'react';
import { parseWhatsApp, type Inline } from '@/features/messaging/whatsapp-format';
import type { ChannelFeatures } from '@/features/messaging/channels';
import { cn } from '@/lib/utils';

function inline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case 'text':
        return n.text;
      case 'bold':
        return <strong key={i}>{inline(n.children)}</strong>;
      case 'italic':
        return <em key={i}>{inline(n.children)}</em>;
      case 'strike':
        return <s key={i}>{inline(n.children)}</s>;
      case 'mono':
      case 'code':
        return (
          <code
            key={i}
            className="rounded-control bg-surface-sunken whitespace-pre-wrap px-1 font-mono"
          >
            {n.text}
          </code>
        );
    }
  });
}

export function MessageText({
  text,
  format,
  className,
}: {
  text: string;
  format: ChannelFeatures['format'];
  className?: string;
}) {
  const base = cn('type-body text-text m-0 break-words', className);
  if (format !== 'whatsapp') return <p className={cn(base, 'whitespace-pre-line')}>{text}</p>;
  return (
    <div className={cn(base, 'space-y-0.5')}>
      {parseWhatsApp(text).map((line, i) => {
        if (line.kind === 'bullet') {
          return (
            <p key={i} className="m-0 flex gap-2">
              <span aria-hidden>•</span>
              <span>{inline(line.inline)}</span>
            </p>
          );
        }
        if (line.kind === 'number') {
          return (
            <p key={i} className="m-0 flex gap-2">
              <span>{line.n}.</span>
              <span>{inline(line.inline)}</span>
            </p>
          );
        }
        if (line.kind === 'quote') {
          return (
            <p key={i} className="border-border text-text-muted m-0 border-l-2 pl-3">
              {inline(line.inline)}
            </p>
          );
        }
        // Una línea vacía conserva su alto, como en el chat.
        return (
          <p key={i} className="m-0 min-h-[1lh] whitespace-pre-wrap">
            {inline(line.inline)}
          </p>
        );
      })}
    </div>
  );
}
