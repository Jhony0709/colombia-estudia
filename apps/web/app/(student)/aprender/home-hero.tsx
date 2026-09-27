/**
 * El hero del panel del estudiante (27/9, del diseño aprobado). Estático: un mensaje de ánimo
 * y el botón que lleva a lo que toca hoy. Sin carrusel. Cuando el cliente quiera gestionarlo
 * (campañas, avisos) será un modelo pequeño; hoy no.
 *
 * La foto (`public/photos/aprender-hero-*.webp`, generada, persona no identificable) va a la
 * derecha y el texto a la izquierda sobre el azul de marca, no encima de la foto: el contraste
 * del texto no depende de la imagen (WCAG 1.4.3). `.hero-photo-scrim` funde el borde
 * izquierdo de la foto con el panel. Dos recortes —ancho para `sm` en adelante, alto para el
 * teléfono— y `next/image` con `sizes` para no bajar 1600 px a un celular con datos limitados
 * (`plan/11-ux.md:20`). Decorativa: el mensaje lo lleva el texto, `alt=""`.
 */

import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/atoms/button';

export async function HomeHero({
  href,
  variant = 'resume',
}: {
  href: string | null;
  /** `start` (27/9): sin matrícula, el hero invita a elegir un curso, no a «continuar». */
  variant?: 'resume' | 'start';
}) {
  const t = await getTranslations('learn.hero');
  const k = (key: 'title' | 'body' | 'cta') => (variant === 'start' ? `start.${key}` : key);

  return (
    <section
      aria-labelledby="hero-titulo"
      className="bg-accent-base text-text-on-accent rounded-card relative min-h-[13rem] overflow-hidden sm:min-h-[15rem]"
    >
      {/* La foto: ancho completo detrás del texto en `sm`+, solo el tercio derecho en el teléfono. */}
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[42%] sm:w-full">
        <Image
          src="/photos/aprender-hero-wide.webp"
          alt=""
          width={1600}
          height={500}
          sizes="(min-width: 640px) 100vw, 0px"
          priority
          className="hidden h-full w-full object-cover object-right-top sm:block"
        />
        <Image
          src="/photos/aprender-hero-tall.webp"
          alt=""
          width={560}
          height={700}
          sizes="(max-width: 639px) 45vw, 0px"
          priority
          className="h-full w-full object-cover object-top sm:hidden"
        />
        <div className="hero-photo-scrim absolute inset-0" />
      </div>
      <div className="relative max-w-[30rem] space-y-4 px-6 py-8 sm:px-10 sm:py-10">
        <p className="type-overline uppercase opacity-90">{t('eyebrow')}</p>
        <h2 id="hero-titulo" className="type-display">
          {t(k('title'))}
        </h2>
        <p className="type-body opacity-90">{t(k('body'))}</p>
        {href && (
          <Button asChild variant="secondary">
            <Link href={href}>
              {t(k('cta'))}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
