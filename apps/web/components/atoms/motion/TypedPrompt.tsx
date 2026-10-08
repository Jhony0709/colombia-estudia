'use client';

/**
 * Tecleo (6/10, experiencia-colombia-estudia §4): la pregunta se escribe sola, como en el chat
 * de cotización de Lemonade, pero sin su fallo de accesibilidad.
 *
 * - La frase completa está en un `sr-only`: el encabezado se enfoca y se lee entera.
 * - Lo que se va escribiendo va `aria-hidden`, encima de un fantasma invisible con la frase
 *   completa que reserva el alto: el layout no salta.
 * - Pausa `duration.fast` y `duration.typeChar` por carácter. Sin parpadeo del cursor
 *   (motion-colombia-estudia veta el parpadeo en texto): está mientras escribe y se va.
 * - `animate={false}`, `complete`, movimiento reducido o la pestaña oculta: la frase entera
 *   ya, y `onDone` en el acto.
 */

import { useEffect, useRef, useState, type ElementType } from 'react';
import { motionReduced } from '@/lib/motion/preference';
import { readDuration } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

export function TypedPrompt({
  text,
  id,
  as: Tag = 'h2',
  animate = true,
  complete = false,
  focusOnMount = false,
  onDone,
  className,
}: {
  text: string;
  id?: string;
  as?: ElementType;
  animate?: boolean;
  /** Termina ya (la persona empezó a responder antes de que acabara). */
  complete?: boolean;
  focusOnMount?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [count, setCount] = useState(animate ? 0 : text.length);
  const done = count >= text.length;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  useEffect(() => {
    const perChar = readDuration('--duration-type-char');
    if (!animate || complete || motionReduced() || document.hidden || perChar === 0) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const pause = readDuration('--duration-fast');
    let frame = 0;
    const start = performance.now() + pause;
    const tick = (now: number) => {
      const next = Math.min(text.length, Math.max(0, Math.floor((now - start) / perChar)));
      setCount(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, animate, complete]);

  useEffect(() => {
    if (done) doneRef.current?.();
  }, [done]);

  return (
    <Tag ref={ref} id={id} tabIndex={-1} className={cn('relative outline-none', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="invisible block">
        {text}
      </span>
      <span aria-hidden="true" className="absolute inset-0">
        {text.slice(0, count)}
        {!done && <span className="typed-caret" />}
      </span>
    </Tag>
  );
}
