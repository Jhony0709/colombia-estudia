import { cn } from '@/lib/utils';
import { MediaPlaceholder } from '../media-placeholder';
import type { MediaId } from '../media';

/**
 * Una foto recortada con una forma de la marca (5/10): `arch` (el arco del hero), `arc` (curva
 * arriba a la derecha), `oval`, `leaf` (esquina redonda grande). La forma es un SVG de
 * `public/brand/masks/` aplicado con `mask-image` (site.css): sin PNG, sin estilos en línea.
 * El tamaño lo pone `className` (alto o aspecto); el `alt` sale de `MEDIA`.
 */
export type PhotoShape = 'arch' | 'arc' | 'oval' | 'leaf';

export function PhotoMask({
  id,
  shape,
  className,
  sizes,
  priority = false,
}: {
  id: MediaId;
  shape: PhotoShape;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <MediaPlaceholder
      id={id}
      rounded="none"
      priority={priority}
      sizes={sizes}
      className={cn('alba-mask', `alba-mask--${shape}`, className)}
    />
  );
}
