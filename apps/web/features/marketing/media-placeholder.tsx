/**
 * Un hueco de fotografía con tamaño, aspecto y recorte ya decididos.
 *
 * Con foto (`MEDIA[id]`), pinta `next/image` con `object-fit: cover` y el punto focal como
 * `object-position`. Sin foto, una superficie neutra con las formas de marca muy suaves y
 * `aria-hidden`: no es contenido, es un sitio reservado. La foto, cuando llegue, exige `alt`
 * por tipo (`EditorialMedia`).
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { MEDIA, ratioOf, type EditorialMedia, type MediaId } from './media';

const RATIO_CLASS = {
  '4/5': 'aspect-[4/5]',
  '16/9': 'aspect-video',
  '3/2': 'aspect-[3/2]',
  '1/1': 'aspect-square',
  '21/9': 'aspect-[21/9]',
  '5/4': 'aspect-[5/4]',
  '3/4': 'aspect-[3/4]',
  '3/1': 'aspect-[3/1]',
} as const;

export interface MediaPlaceholderProps {
  id: MediaId;
  className?: string;
  /** Radio del recorte; por defecto el de tarjeta. */
  rounded?: 'card' | 'sheet' | 'none';
  /** `true` para la foto del hero: se carga antes que nada. */
  priority?: boolean;
  /** `sizes` de next/image, para que no descargue 1600 px en un hueco de 400. */
  sizes?: string;
}

export function MediaPlaceholder({
  id,
  className,
  rounded = 'card',
  priority = false,
  sizes = '(min-width: 1024px) 50vw, 100vw',
}: MediaPlaceholderProps) {
  const media = MEDIA[id];
  const ratio = ratioOf(id);
  const shape = cn(
    'relative overflow-hidden',
    RATIO_CLASS[ratio],
    rounded === 'card' && 'rounded-card',
    rounded === 'sheet' && 'rounded-sheet',
    className
  );

  if (media) {
    return (
      <figure className={shape} data-media-id={id}>
        {/*
          Sin `fill`: next/image lo implementa con un atributo `style` en línea y la CSP del
          middleware no permite estilos en línea (solo `nonce` en <style>), así que el `img`
          quedaba `position: static`. Con medidas reales y clases se comporta igual. El punto
          focal se traduce a una de las nueve posiciones de `object-position` por la misma razón.
        */}
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes={sizes}
          priority={priority}
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            objectPositionClass(media.focalPoint)
          )}
        />
      </figure>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-media-id={id}
      className={cn(shape, 'bg-surface-sunken border-border-muted border')}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-40"
      >
        <path className="fill-accent-base" d="M0 100C20 60 45 55 100 40v60Z" opacity=".18" />
        <path className="fill-brand-yellow" d="M0 100c30-25 55-30 100-25v25Z" opacity=".35" />
      </svg>
    </div>
  );
}

/**
 * Nueve posiciones, no un porcentaje: `object-position: 30% 45%` necesitaría un estilo en
 * línea que la CSP no deja pasar. Tercios: < 0.34 es el borde, > 0.66 el opuesto, el resto centro.
 */
/*
  Cuadrícula de 5 × 5 posiciones (pasos del 25 %): el punto focal se redondea a la más
  cercana. Son clases literales para que Tailwind las genere; `object-position: 30% 45%` en
  línea no pasa la CSP. Con tercios (left/center/right) una persona en el 30 % del ancho
  quedaba pegada al borde en recortes verticales (19/9).
*/
const OBJECT_POSITION: Record<string, string> = {
  '0-0': 'object-[0%_0%]',
  '0-25': 'object-[0%_25%]',
  '0-50': 'object-[0%_50%]',
  '0-75': 'object-[0%_75%]',
  '0-100': 'object-[0%_100%]',
  '25-0': 'object-[25%_0%]',
  '25-25': 'object-[25%_25%]',
  '25-50': 'object-[25%_50%]',
  '25-75': 'object-[25%_75%]',
  '25-100': 'object-[25%_100%]',
  '50-0': 'object-[50%_0%]',
  '50-25': 'object-[50%_25%]',
  '50-50': 'object-[50%_50%]',
  '50-75': 'object-[50%_75%]',
  '50-100': 'object-[50%_100%]',
  '75-0': 'object-[75%_0%]',
  '75-25': 'object-[75%_25%]',
  '75-50': 'object-[75%_50%]',
  '75-75': 'object-[75%_75%]',
  '75-100': 'object-[75%_100%]',
  '100-0': 'object-[100%_0%]',
  '100-25': 'object-[100%_25%]',
  '100-50': 'object-[100%_50%]',
  '100-75': 'object-[100%_75%]',
  '100-100': 'object-[100%_100%]',
};

const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 4) * 25;

export function objectPositionClass(fp?: EditorialMedia['focalPoint']): string {
  if (!fp) return OBJECT_POSITION['50-50']!;
  return OBJECT_POSITION[`${q(fp.x)}-${q(fp.y)}`]!;
}
