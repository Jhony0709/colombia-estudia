/**
 * Formas de marca (manual: "Patrones gráficos", "Estilo visual: formas fluidas"). Tres
 * piezas, decorativas (`aria-hidden`), con los colores de la piel de la portada. Se usan en
 * sitios contados: detrás de la persona del hero, en la esquina de las bandas azules y en el
 * pie. No son relleno.
 */

import { cn } from '@/lib/utils';

/** Detrás de la persona del hero: mancha amarilla, cinta azul que cruza, gota roja abajo. */
export function HeroShapes({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 560 560"
      className={cn('h-full w-full', className)}
    >
      <path
        fill="var(--site-yellow)"
        d="M330 20c95-30 200 30 205 130 4 78-55 145-130 165-95 25-190-35-205-125-14-80 45-145 130-170Z"
      />
      <path
        fill="var(--site-blue)"
        d="M20 330c15-110 120-190 240-175 130 16 215 135 190 255-22 105-135 165-250 140C75 520-5 430 20 330Z"
      />
      <path
        fill="var(--site-red)"
        d="M150 470c60-60 170-55 225 10 30 35 42 80 35 80H140c-20-30-15-65 10-90Z"
      />
      <path
        fill="var(--site-blue-deep)"
        d="M380 300c40 0 70 30 70 70s-30 70-70 70-70-30-70-70 30-70 70-70Z"
        opacity=".18"
      />
    </svg>
  );
}

/** Esquina superior derecha de una banda: como las cabeceras del manual, en miniatura. */
export function CornerRibbon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 320 220"
      className={cn('h-auto w-72', className)}
    >
      <path fill="var(--site-yellow)" d="M320 0v110C240 120 170 95 130 40 110 15 90 5 60 0Z" />
      <path
        fill="var(--site-red)"
        d="M320 60v100c-70 5-130-25-160-80 40 10 100 5 160-20Z"
        opacity=".95"
      />
      <path
        fill="var(--site-blue-hover)"
        d="M320 130v90c-90-10-160-60-190-140 40 40 110 55 190 50Z"
      />
    </svg>
  );
}

/** Subrayado ondulado de marca bajo un título. */
export function Underline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 12"
      className={cn('site-underline h-3 w-28', className)}
    >
      <path
        d="M2 8c20-8 40-8 60 0s40 8 56 0"
        fill="none"
        stroke="var(--site-yellow)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
