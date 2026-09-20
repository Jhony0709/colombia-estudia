'use client';

/**
 * La ayuda de esta pantalla: un botón fijo abajo a la derecha que abre una hoja con lo que
 * hay que saber para usar la pantalla en la que se está.
 *
 * Por qué así y no un `details` en medio de la página: la chuleta del formato del editor
 * vivía plegada entre el texto y los minutos, estorbando a quien ya la sabía y escondida de
 * quien no. Una ayuda es algo que se pide, no algo que se lee de paso; un botón siempre en el
 * mismo sitio es una promesa que la persona aprende una vez.
 *
 * Cada pantalla declara sus temas. La lista es datos —título y cuerpo—, así que la misma
 * hoja sirve para el editor, para las listas y para lo que venga. Sin temas, no hay botón:
 * un botón de ayuda que abre una hoja vacía es peor que ninguno.
 *
 * El botón es lo último del DOM de la página: con el tabulador se llega a él después del
 * contenido, que es donde uno pediría ayuda. Es fijo y no flotante en el sentido de
 * `elevation-floating` —no es un menú—; lleva `elevation-modal` porque se apoya sobre todo lo
 * demás y tiene que verse sobre una tarjeta blanca y sobre el lienzo.
 */

import { CircleHelp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Tooltip } from '@/components/atoms/tooltip';
import { Sheet } from '@/components/organisms/sheet';

export interface HelpTopic {
  title: string;
  body: ReactNode;
}

export interface PageHelpProps {
  /** El nombre de la pantalla, para el título de la hoja: «Ayuda: Temas». */
  screen: string;
  topics: HelpTopic[];
}

export function PageHelp({ screen, topics }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  if (topics.length === 0) return null;

  return (
    <>
      <Tooltip label="Ayuda de esta pantalla" side="left">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-accent-base text-text-on-accent hover:bg-accent-hover active:bg-accent-active rounded-pill elevation-modal duration-fast ease-standard fixed bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center transition-colors sm:bottom-6 sm:right-6"
        >
          <CircleHelp aria-hidden="true" className="h-6 w-6" />
          <span className="sr-only">Ayuda de esta pantalla</span>
        </button>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen} title={`Ayuda: ${screen}`}>
        <div className="divide-border-muted -my-5 divide-y">
          {topics.map((topic) => (
            <section key={topic.title} className="space-y-2 py-5">
              <h3 className="type-body-emphasis text-text">{topic.title}</h3>
              <div className="type-body text-text-muted space-y-2">{topic.body}</div>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
