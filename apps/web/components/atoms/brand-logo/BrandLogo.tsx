/**
 * El logo de Colombia Estudia, según el tema: a color sobre claro, blanco sobre oscuro.
 * SSOT: reference/03-ui/tokens.md § Marca; manual de marca (variantes "color sobre fondo
 * blanco" y "blanco sobre fondo azul").
 *
 * Dos `<img>` y una utilidad por tema (`only-light` / `only-dark`, design-tokens): sin
 * JavaScript, sin parpadeo, y cubre `.dark` y `.theme-system` a la vez. El azul del logo
 * (#002C80) da 1.49:1 sobre el lienzo oscuro, por eso ahí va la variante blanca y no la de
 * color. Solo una de las dos está en el árbol de accesibilidad: `display: none` saca a la otra.
 *
 * Origen de los ficheros: docs/brand/colombia-estudia-logo-original.png (PNG, no hay vector).
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

const VARIANTS = {
  horizontal: {
    light: '/brand/logo-horizontal.png',
    dark: '/brand/logo-horizontal-white.png',
    width: 800,
    height: 394,
  },
  isotipo: {
    light: '/brand/isotipo.png',
    dark: '/brand/isotipo-white.png',
    width: 203,
    height: 256,
  },
} as const;

export interface BrandLogoProps {
  variant?: keyof typeof VARIANTS;
  /** Texto alternativo. Vacío cuando el nombre ya va escrito al lado (decorativo). */
  alt?: string;
  /** Alto por clase (`h-10`, `h-7`); el ancho se deriva de la proporción. */
  className?: string;
  /** `true` en el logo de la portada: es lo primero que se pinta. */
  priority?: boolean;
}

export function BrandLogo({
  variant = 'horizontal',
  alt = 'Colombia Estudia',
  className,
  priority = false,
}: BrandLogoProps) {
  const v = VARIANTS[variant];
  // `alt` va explícito en cada `<Image>`: `jsx-a11y/alt-text` no mira dentro de un spread.
  const shared = { width: v.width, height: v.height, priority };
  return (
    <>
      <Image src={v.light} alt={alt} {...shared} className={cn('only-light w-auto', className)} />
      <Image src={v.dark} alt={alt} {...shared} className={cn('only-dark w-auto', className)} />
    </>
  );
}
