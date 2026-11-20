'use client';

/**
 * Visor de imágenes del contenido (19/11): cualquier imagen de un tema se abre a pantalla
 * completa para acercarla y moverla. Los diagramas llevan rótulos que en un teléfono quedan
 * pequeños; aquí se leen.
 *
 * Como `Escenas`, trabaja sobre el HTML ya saneado: envuelve cada `img` de `.contenido` en un
 * botón (sin JS, la imagen sigue ahí, quieta). No es `Dialog`: no tiene acciones ni panel, ocupa
 * la pantalla, como `Sheet` ocupa un lado. Radix pone el foco dentro, cierra con Escape y lo
 * devuelve al botón.
 *
 * Acercar: botones, rueda, doble clic, pellizco o las teclas + y −; con zoom se arrastra o se
 * mueve con las flechas. 0 vuelve a ajustar.
 */

import * as RadixDialog from '@radix-ui/react-dialog';
import { Minus, Plus, Scan, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

interface Shown {
  src: string;
  alt: string;
  caption: string;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN = 1;
const MAX = 5;
const STEP = 1.5;
const FIT: View = { scale: 1, x: 0, y: 0 };

/** Sin salirse del lienzo: con zoom 1 vuelve al centro. */
function bound(el: HTMLElement | null, next: View): View {
  const rect = el?.getBoundingClientRect();
  if (!rect || next.scale <= MIN) return FIT;
  const maxX = (rect.width * (next.scale - 1)) / 2;
  const maxY = (rect.height * (next.scale - 1)) / 2;
  return {
    scale: next.scale,
    x: Math.min(maxX, Math.max(-maxX, next.x)),
    y: Math.min(maxY, Math.max(-maxY, next.y)),
  };
}

/** Lleva `from` a `scale` dejando quieto el punto `at` (relativo al centro del lienzo). */
function zoomAt(el: HTMLElement | null, from: View, scale: number, at = { x: 0, y: 0 }): View {
  const next = Math.min(MAX, Math.max(MIN, scale));
  const ratio = next / from.scale;
  return bound(el, {
    scale: next,
    x: at.x - (at.x - from.x) * ratio,
    y: at.y - (at.y - from.y) * ratio,
  });
}

function moved(dx: number, dy: number) {
  return (v: View, el: HTMLElement | null) => bound(el, { ...v, x: v.x + dx, y: v.y + dy });
}

function fromCenter(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

/** `watch`: cuando cambia (la vista previa del editor), se vuelven a buscar las imágenes. */
export function VisorImagen({ watch }: { watch?: string } = {}) {
  const t = useTranslations('learn.lesson.viewer');
  const [shown, setShown] = useState<Shown | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openLabel = t('open');

  useEffect(() => {
    for (const img of document.querySelectorAll<HTMLImageElement>('.contenido img')) {
      if (img.parentElement?.classList.contains('visor-abrir')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'visor-abrir';
      button.setAttribute('aria-label', img.alt ? `${openLabel}: ${img.alt}` : openLabel);
      img.replaceWith(button);
      button.append(img);
    }
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.('.contenido .visor-abrir');
      const img = button?.querySelector('img');
      if (!button || !img) return;
      opener.current = button as HTMLElement;
      const caption = button.closest('figure.figura')?.querySelector('figcaption')?.textContent;
      setShown({ src: img.currentSrc || img.src, alt: img.alt, caption: caption?.trim() ?? '' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [watch, openLabel]);

  const title = shown ? shown.caption || shown.alt || t('untitled') : '';
  const describe = Boolean(shown?.caption && shown.alt);

  return (
    <RadixDialog.Root open={shown !== null} onOpenChange={(open) => !open && setShown(null)}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="visor-fondo dialog-overlay fixed inset-0 z-40 backdrop-blur-sm" />
        <RadixDialog.Content
          {...(describe ? {} : { 'aria-describedby': undefined })}
          // Sin `Trigger`, Radix no sabe a dónde devolver el foco: al botón de la imagen.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="visor dialog-overlay fixed inset-0 z-50 flex flex-col"
        >
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <RadixDialog.Title className="type-body-emphasis line-clamp-2 min-w-0 pt-2">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close className="visor-boton">
              <X aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only">{t('close')}</span>
            </RadixDialog.Close>
          </div>
          {shown && <Lienzo key={shown.src} src={shown.src} alt={shown.alt} />}
          {describe && (
            <RadixDialog.Description className="visor-suave type-caption max-h-24 overflow-y-auto px-4 pb-4">
              {shown?.alt}
            </RadixDialog.Description>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function Lienzo({ src, alt }: { src: string; alt: string }) {
  const t = useTranslations('learn.lesson.viewer');
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(FIT);
  const [moving, setMoving] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; view: View } | null>(null);

  const zoom = (scale: number) => setView((v) => zoomAt(stage.current, v, scale));

  // Rueda y doble clic, nativos: el `onWheel` de React es pasivo y no puede cancelar el scroll.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = fromCenter(el, event.clientX, event.clientY);
      setView((v) => zoomAt(el, v, v.scale * Math.exp(-event.deltaY / 300), at));
    };
    // Doble clic: acerca a ese punto, o vuelve a ajustar si ya estaba acercada.
    const onDoubleClick = (event: MouseEvent) => {
      const at = fromCenter(el, event.clientX, event.clientY);
      setView((v) => (v.scale > MIN ? FIT : zoomAt(el, v, 2.5, at)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDoubleClick);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDoubleClick);
    };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), view };
    }
    setMoving(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const middle = fromCenter(event.currentTarget, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const start = pinch.current;
      setView(
        zoomAt(stage.current, start.view, (start.view.scale * distance) / start.distance, middle)
      );
      return;
    }
    setView((v) => moved(event.clientX - last.x, event.clientY - last.y)(v, stage.current));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setMoving(false);
  };

  // El teclado, mientras el visor está abierto: + y − acercan, las flechas mueven, 0 ajusta.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        '+': () => setView((v) => zoomAt(stage.current, v, v.scale * STEP)),
        '=': () => setView((v) => zoomAt(stage.current, v, v.scale * STEP)),
        '-': () => setView((v) => zoomAt(stage.current, v, v.scale / STEP)),
        '0': () => setView(FIT),
        ArrowLeft: () => setView((v) => moved(60, 0)(v, stage.current)),
        ArrowRight: () => setView((v) => moved(-60, 0)(v, stage.current)),
        ArrowUp: () => setView((v) => moved(0, 60)(v, stage.current)),
        ArrowDown: () => setView((v) => moved(0, -60)(v, stage.current)),
      };
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <div
        ref={stage}
        className="visor-lienzo relative min-h-0 flex-1 overflow-hidden"
        data-moving={moving || undefined}
        data-zoomed={view.scale > MIN || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- la URL firmada del asset, ya cargada en la página */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="visor-imagen absolute inset-0 m-auto max-h-full max-w-full select-none"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
        <button
          type="button"
          className="visor-boton"
          onClick={() => zoom(view.scale / STEP)}
          aria-disabled={view.scale <= MIN || undefined}
        >
          <Minus aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">{t('zoomOut')}</span>
        </button>
        <output className="type-label w-14 text-center tabular-nums" aria-live="polite">
          {Math.round(view.scale * 100)} %
        </output>
        <button
          type="button"
          className="visor-boton"
          onClick={() => zoom(view.scale * STEP)}
          aria-disabled={view.scale >= MAX || undefined}
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">{t('zoomIn')}</span>
        </button>
        <button type="button" className="visor-boton" onClick={() => setView(FIT)}>
          <Scan aria-hidden="true" className="h-5 w-5" />
          <span className="sr-only">{t('fit')}</span>
        </button>
        <p className="visor-suave type-caption basis-full text-center">{t('hint')}</p>
      </div>
    </>
  );
}
