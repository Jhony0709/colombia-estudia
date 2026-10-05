'use client';

/**
 * Una pregunta del acordeón (5/10). Sigue siendo `<details>`/`<summary>` (teclado, lector de
 * pantalla y sin JavaScript); esto solo anima la apertura: alto 0 → auto y opacidad en 220 ms,
 * sin spring. Al cerrar, lo mismo al revés y después se quita `open`. Interrumpible: un segundo
 * clic a medio camino da la vuelta desde donde está, sin saltos. Con movimiento reducido (o la
 * pestaña oculta, donde no hay fotogramas), el comportamiento nativo: corte seco. El chevron
 * gira con CSS (`[open]`).
 *
 * Es la única animación de alto de la portada: el acordeón no tiene otra forma de abrir sin
 * saltar, dura 220 ms y solo mueve lo que hay debajo de la pregunta.
 */

import { useRef, type MouseEvent, type ReactNode } from 'react';
import { animate } from 'motion';
import { prefersReducedMotion } from '../motion/env';
import { motionTokens } from '../motion/tokens';

export function FaqItem({ question, children }: { question: ReactNode; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const running = useRef<ReturnType<typeof animate> | null>(null);
  /** Turno de la animación en curso: la que se interrumpe no termina nada al resolverse. */
  const turn = useRef(0);
  /** Hacia dónde va: cambia en cada clic, aunque la animación anterior no haya terminado. */
  const opening = useRef(false);

  const onToggle = (event: MouseEvent<HTMLElement>) => {
    const el = details.current;
    const content = body.current;
    if (!el || !content || prefersReducedMotion() || document.visibilityState !== 'visible') {
      return;
    }
    event.preventDefault();

    const from = running.current ? content.getBoundingClientRect().height : null;
    running.current?.stop();
    opening.current = running.current ? !opening.current : !el.open;

    const mine = ++turn.current;
    const reset = () => {
      if (mine !== turn.current) return;
      content.style.height = '';
      content.style.opacity = '';
      content.style.overflow = '';
      running.current = null;
    };
    const options = {
      duration: motionTokens.duration.accordion,
      ease: motionTokens.easing.standard,
    };

    content.style.overflow = 'hidden';
    if (opening.current) {
      el.open = true;
      const target = content.scrollHeight;
      running.current = animate(
        content,
        { height: [from ?? 0, target], opacity: [from === null ? 0 : 1, 1] },
        options
      );
      running.current.then(reset);
    } else {
      running.current = animate(
        content,
        { height: [from ?? content.scrollHeight, 0], opacity: [1, 0] },
        options
      );
      running.current.then(() => {
        if (mine !== turn.current) return;
        el.open = false;
        reset();
      });
    }
  };

  return (
    <details ref={details} className="site-faq">
      <summary onClick={onToggle}>{question}</summary>
      <div ref={body} className="site-body">
        {children}
      </div>
    </details>
  );
}
