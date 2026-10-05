import { cn } from '@/lib/utils';
import { PhotoMask } from './photo-mask';
import { AlbaWave } from './alba-wave';
import { MaskReveal } from '../motion/MaskReveal';
import { AnimatedWave } from '../motion/AnimatedWave';

/**
 * La foto de «Historias reales» (5/10): un óvalo grande, recortado por el borde de la sección, y
 * las ondas de la marca cruzándolo por abajo. Las ondas son capas propias para poder animarlas
 * después sin tocar la sección.
 *
 * Movimiento («otras personas ya avanzaron»): la foto se descubre desde abajo y los dos trazos
 * se dibujan de izquierda a derecha (`pathLength`), el único dibujo de trazo junto a la línea
 * del proceso.
 */
export function StoryVisual({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <MaskReveal from="bottom">
        <PhotoMask
          id="home-story"
          shape="oval"
          className="aspect-square w-full"
          sizes="(min-width: 1024px) 40vw, 90vw"
        />
      </MaskReveal>
      <AnimatedWave mode="draw" className="absolute bottom-[-2%] left-[-8%] h-[34%] w-[116%]">
        <AlbaWave variant="story" className="h-full" />
      </AnimatedWave>
    </div>
  );
}
