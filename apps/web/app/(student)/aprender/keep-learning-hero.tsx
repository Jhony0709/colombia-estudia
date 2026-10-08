/**
 * El héroe del programa terminado (8/10, Jhonny: «uno que invite a seguir aprendiendo y a escoger
 * uno de los cursos, con un mensaje motivacional que cambie cada vez que se recarga»). El logro va
 * de antetítulo; el título es el mensaje; la acción, elegir el siguiente curso.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Award, ChartColumn, CircleCheck } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { BrandWave } from '@/components/atoms/brand-wave';

const MESSAGES = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'] as const;

export async function KeepLearningHero({
  program,
  openCourses,
  switcher,
}: {
  program: string;
  /** Cursos que puede tomar: sin ninguno, la acción pasa a sus resultados. */
  openCourses: number;
  switcher: ReactNode;
}) {
  const t = await getTranslations('learn.keepLearning');
  // Server Component dinámico: cada carga es una petición y un mensaje.
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]!;

  return (
    <section
      aria-labelledby="seguir-titulo"
      className="bg-accent-base text-text-on-accent rounded-card motion-enter-md relative overflow-hidden sm:min-h-[17rem]"
    >
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[46%] sm:block">
        <Image
          src="/photos/aprender-hero-wide.webp"
          alt=""
          width={1600}
          height={500}
          sizes="(min-width: 640px) 46vw, 0px"
          priority
          className="h-full w-full object-cover object-right-top"
        />
        {/* Un píxel más a la izquierda: el borde fraccional de la foto dejaba una raya. */}
        <div className="hero-cover-scrim absolute inset-y-0 -left-px right-0" />
      </div>

      <BrandWave base="canvas" className="absolute inset-x-0 -bottom-px h-12 sm:h-20" />

      <div className="relative max-w-[36rem] space-y-5 p-6 pb-16 sm:p-10 sm:pb-24">
        <div className="space-y-2">
          {switcher ?? (
            <p className="type-overline m-0 inline-flex items-center gap-1.5 uppercase opacity-90">
              <CircleCheck aria-hidden className="size-4 shrink-0" />
              {t('overline', { program })}
            </p>
          )}
          <h2 id="seguir-titulo" className="type-display m-0 text-balance">
            {t(`messages.${message}`)}
          </h2>
        </div>

        <p className="type-body max-w-reading m-0 opacity-90">
          {openCourses > 0 ? t('body', { count: openCourses }) : t('bodyNone')}
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {openCourses > 0 ? (
            <Button asChild size="lg" variant="secondary">
              <a href="#cursos-abiertos">
                {t('choose')}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </a>
            </Button>
          ) : (
            <Button asChild size="lg" variant="secondary">
              <Link href="/aprender/resultados">
                {t('results')}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </Button>
          )}
          {openCourses > 0 && (
            <Link
              href="/aprender/resultados"
              className="type-body min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
            >
              <ChartColumn aria-hidden className="size-4 shrink-0" />
              {t('results')}
            </Link>
          )}
          <Link
            href="/aprender/certificados"
            className="type-body min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
          >
            <Award aria-hidden className="size-4 shrink-0" />
            {t('certificates')}
          </Link>
        </div>
      </div>
    </section>
  );
}
