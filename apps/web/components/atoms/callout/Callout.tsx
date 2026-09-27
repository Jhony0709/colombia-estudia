/**
 * Un recuadro con título: nota, ejemplo o importante (27/9).
 *
 * Es el mismo `<aside class="callout callout-<kind>">` que `renderLessonHtml` saca de un
 * `:::callout` del Markdown, con las mismas clases de `globals.css`: lo que el autor escribe
 * en el tema y lo que la plataforma pone alrededor (el objetivo de aprendizaje) se ven igual.
 * Sin `role`: no es un aviso vivo como `Alert`, es contenido que está ahí desde el principio.
 * Server Component: no lleva estado ni manejadores.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CalloutKind } from '@colombia-estudia/types/callouts';

export interface CalloutProps {
  kind?: CalloutKind;
  title: string;
  /** Un icono decorativo delante del título; quien lo pasa ya lo marca `aria-hidden`. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Callout({ kind = 'note', title, icon, children, className }: CalloutProps) {
  return (
    <aside className={cn('callout', `callout-${kind}`, className)}>
      <p className="callout-title inline-flex items-center gap-2">
        {icon}
        {title}
      </p>
      {children}
    </aside>
  );
}
