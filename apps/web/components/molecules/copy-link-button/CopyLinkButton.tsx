'use client';

/**
 * Copia el enlace de una página al portapapeles (8/10, constancias). `path` relativo: el
 * origen lo pone el navegador. El aviso «Enlace copiado» se anuncia (`role="status"`).
 */

import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/atoms/button';

export function CopyLinkButton({
  path,
  label,
  copiedLabel,
  variant = 'secondary',
}: {
  path: string;
  label: string;
  copiedLabel: string;
  variant?: 'secondary' | 'quiet';
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de la API (pestaña sin foco, http): la vía antigua.
      const area = document.createElement('textarea');
      area.value = url;
      area.setAttribute('readonly', '');
      area.className = 'sr-only';
      document.body.append(area);
      area.select();
      setCopied(document.execCommand('copy'));
      area.remove();
    }
  };

  return (
    <>
      <Button type="button" variant={variant} onClick={() => void copy()}>
        {copied ? (
          <Check aria-hidden className="size-4 shrink-0" />
        ) : (
          <Link2 aria-hidden className="size-4 shrink-0" />
        )}
        {copied ? copiedLabel : label}
      </Button>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
