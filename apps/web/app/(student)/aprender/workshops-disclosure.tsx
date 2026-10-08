'use client';

/**
 * «Ver talleres» de la tarjeta del catálogo (7/10): acordeón con `grid-template-rows` 0fr → 1fr
 * (la excepción de motion para acordeones); al abrir, la lista entra con `motion-enter`.
 * Cerrado, `invisible` la saca del foco y del árbol de accesibilidad al terminar la transición.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkshopsDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="type-label text-text-link min-h-touch inline-flex items-center gap-1.5"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn(
            'duration-normal ease-standard size-4 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows,visibility]',
          open
            ? 'ease-enter duration-normal visible grid-rows-[1fr]'
            : 'ease-exit duration-normal invisible grid-rows-[0fr]'
        )}
      >
        {/* Sin el retardo de escalera que hereda de la rejilla del catálogo. */}
        <div
          className={cn(
            'min-h-0 overflow-hidden',
            open && 'motion-enter [--motion-i:0] [--motion-order:0]'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
