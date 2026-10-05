/**
 * El logo de ALBA Futuro Educativo (5/10; antes Colombia Estudia), según el tema: a color sobre
 * claro, blanco sobre oscuro. SSOT: docs/brand/README.md (ALBA) y alba-brand-board.png.
 *
 * Dos `<img>` y una utilidad por tema (`only-light` / `only-dark`, design-tokens): sin
 * JavaScript, sin parpadeo, y cubre `.dark` y `.theme-system` a la vez. Solo una de las dos está
 * en el árbol de accesibilidad: `display: none` saca a la otra.
 *
 * Origen: el isotipo oficial (`docs/brand/alba-isotipo-original.png`, 1254 px, solo el símbolo)
 * limpio y recortado, y el nombre compuesto en Lexend 700/500 (`docs/brand/README.md` cuenta
 * cómo). No hay vector todavía.
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

const VARIANTS = {
  horizontal: {
    light: '/brand/alba-logo-horizontal.png',
    dark: '/brand/alba-logo-horizontal-white.png',
    width: 1229,
    height: 400,
  },
  isotipo: {
    light: '/brand/alba-isotipo.png',
    dark: '/brand/alba-isotipo-white.png',
    width: 256,
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
  alt = 'ALBA Futuro Educativo',
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
