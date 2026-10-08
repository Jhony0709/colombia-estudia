'use client';

/**
 * Entrada cuando un valor cambia en la sesión, no al cargar (6/10, experiencia §6). Para lo
 * que el servidor vuelve a pintar tras `router.refresh()`: el pie del tema al completarse.
 * El primer render no anima (P1); cada cambio posterior vuelve a montar y entra.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EnterOnChange({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const first = useRef(value);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (value !== first.current) setChanged(true);
  }, [value]);

  return (
    <span key={changed ? value : 'inicial'} className={cn(changed && 'motion-enter', className)}>
      {children}
    </span>
  );
}
