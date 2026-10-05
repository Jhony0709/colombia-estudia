'use client';

/**
 * «En este tema» (4/10): los `##` del tema a la derecha del texto, solo desde `xl` y cuando
 * hay tres o más (con menos, el índice repite lo que ya se ve). Marca la sección que se lee
 * —borde, peso y color, no solo color— y el salto es el del ancla, sin animar.
 */

import { useEffect, useState } from 'react';
import type { LessonOutlineItem } from '@colombia-estudia/types';
import { cn } from '@/lib/utils';

/** Un título cuenta como «leyéndose» cuando sube por encima de esta línea (px desde arriba). */
const READING_LINE = 120;

export function LessonOutline({ items, label }: { items: LessonOutlineItem[]; label: string }) {
  const [current, setCurrent] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null);
    if (headings.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const passed = headings.filter((h) => h.getBoundingClientRect().top <= READING_LINE);
      setCurrent((passed.at(-1) ?? headings[0]!).id);
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav aria-labelledby="en-este-tema" className="sticky top-20 hidden self-start xl:block">
      <p id="en-este-tema" className="type-overline text-text-muted">
        {label}
      </p>
      <ol className="border-border-muted mt-3 border-l">
        {items.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'type-caption hover:text-text -ml-px block border-l-2 py-1.5 pl-3',
                  active
                    ? 'border-accent-base text-text font-semibold'
                    : 'text-text-muted border-transparent'
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
