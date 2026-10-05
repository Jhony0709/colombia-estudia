import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * El logo de ALBA Futuro Educativo en la portada (5/10). Los ficheros salen del isotipo oficial
 * (`docs/brand/alba-isotipo-original.png`) con el nombre en Lexend, igual que el `BrandLogo` del
 * producto (`public/brand/`). Decorativo (`alt=""`): el nombre accesible lo pone el enlace que lo
 * envuelve, o el texto que va al lado.
 */
const FILES = {
  color: { src: '/brand/alba-logo-horizontal.png', width: 1229, height: 400 },
  white: { src: '/brand/alba-logo-horizontal-white.png', width: 1229, height: 400 },
  compact: { src: '/brand/alba-isotipo.png', width: 256, height: 256 },
} as const;

export function AlbaLogo({
  tone = 'color',
  compact = false,
  priority = false,
  className,
}: {
  /** `white` sobre fondos navy. */
  tone?: 'color' | 'white';
  /** Solo el isotipo. */
  compact?: boolean;
  /** En la cabecera: es lo primero que se pinta. */
  priority?: boolean;
  /** Alto por clase (`h-10`); el ancho sale de la proporción. */
  className?: string;
}) {
  const file = compact ? FILES.compact : FILES[tone];
  return (
    <Image
      src={file.src}
      alt=""
      width={file.width}
      height={file.height}
      priority={priority}
      className={cn('h-10 w-auto', className)}
    />
  );
}
